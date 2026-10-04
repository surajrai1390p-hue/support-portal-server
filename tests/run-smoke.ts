/**
 * End-to-end integration smoke test for the backend.
 * Boots Express with mongoose mocked, exercises every route, prints results.
 *
 * Run: npx ts-node tests/run-smoke.ts
 */
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import request from "supertest";
import { createHmac } from "crypto";

// ---------- mocks ----------
type StoredUser = any;
const users: StoredUser[] = [];
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; verified?: boolean }>();

const matchUser = (u: StoredUser, q: any) =>
  Object.entries(q || {}).every(([k, v]: [string, any]) => {
    if (v && typeof v === "object" && "$regex" in v) {
      return new RegExp(v.$regex, v.$options || "").test(String(u[k]));
    }
    return u[k] === v;
  });

const UserMock = {
  findOne: (q: any) => {
    const u = users.find((u) => matchUser(u, q)) || null;
    if (!u) return Promise.resolve(null);
    // Attach a `save()` so routes that mutate and persist work.
    (u as any).save = async function () { return this; };
    return Promise.resolve(u);
  },
  create: async (doc: any) => {
    const u = {
      _id: String(users.length + 1),
      ...doc,
      role: doc.role || "Customer",
      isActive: true,
      save: async function () { return this; },
    };
    users.push(u);
    return u;
  },
};

// Replace require cache so routes import our mock User
(require.cache as any)[require.resolve("../src/models/user")] = {
  id: "User",
  filename: "User.ts",
  loaded: true,
  exports: { __esModule: true, default: UserMock },
};

// db mock
(require.cache as any)[require.resolve("../src/config/db")] = {
  id: "db",
  filename: "db.ts",
  loaded: true,
  exports: { connectDB: async () => {} },
};

// mailer mock — capture OTPs
const otpEmails: { to: string; otp: string }[] = [];
(require.cache as any)[require.resolve("../src/utils/mailer")] = {
  id: "mailer",
  filename: "mailer.ts",
  loaded: true,
  exports: {
    sendOtpEmail: async (to: string, otp: string) => {
      otpEmails.push({ to, otp });
    },
  },
};

// jose mock — HMAC-SHA256 base64url
const b64u = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

(require.cache as any)[require.resolve("jose")] = {
  id: "jose",
  filename: "jose",
  loaded: true,
  exports: {
    SignJWT: class {
      p: any;
      constructor(p: any) { this.p = p; }
      setProtectedHeader() { return this; }
      setIssuedAt() { return this; }
      setExpirationTime() { return this; }
      async sign(key: any) {
        const k = typeof key.toString === "function" ? key.toString() : Buffer.from(key).toString();
        const h = b64u(Buffer.from(JSON.stringify({ alg: "HS256" })));
        const b = b64u(Buffer.from(JSON.stringify({ ...this.p, iat: Math.floor(Date.now() / 1000) })));
        const s = b64u(createHmac("sha256", k).update(`${h}.${b}`).digest());
        return `${h}.${b}.${s}`;
      }
    },
    jwtVerify: async (token: string, key: any) => {
      const [h, b, s] = token.split(".");
      const k = typeof key.toString === "function" ? key.toString() : Buffer.from(key).toString();
      const exp = b64u(createHmac("sha256", k).update(`${h}.${b}`).digest());
      if (exp !== s) throw new Error("bad sig");
      return { payload: JSON.parse(fromB64u(b).toString()) };
    },
  },
};

// otp store mock — share with the real lib/otp via require.cache
(require.cache as any)[require.resolve("../src/utils/otp")] = {
  id: "otp",
  filename: "otp.ts",
  loaded: true,
  exports: {
    generateOtp: () => "123456",
    setOtp: (key: string, otp: string, ttlMin: number) =>
      otpStore.set(key, { otp, expiresAt: Date.now() + ttlMin * 60_000, attempts: 0 }),
    getOtp: (key: string) => otpStore.get(key) || null,
    bumpAttempt: (key: string) => {
      const e = otpStore.get(key);
      if (!e) return null;
      e.attempts += 1;
      return e;
    },
    clearOtp: (key: string) => otpStore.delete(key),
    enforceOtpRequestLimit: (_key: string) => {},
  },
};

// ---------- import routes AFTER mocks ----------
import authRoutes from "../src/routes/auth.routes";
import registerRoutes from "../src/routes/register.routes";
import forgotRoutes from "../src/routes/forgot.routes";
import supportRoutes from "../src/routes/support.routes";

// ---------- build app ----------
const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.get("/health", (_: any, res: any) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/register", registerRoutes);
app.use("/api/forgot", forgotRoutes);
app.use("/api/support", supportRoutes);

// ---------- assertions ----------
let passed = 0, failed = 0;
const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  if (ok) passed++; else failed++;
}

async function main() {
  console.log("\n=== Backend integration smoke ===\n");

  const agent = request.agent(app);

  // 1. health
  let r = await request(app).get("/health");
  check("GET /health → 200 {ok:true}", r.status === 200 && r.body.ok === true, `got ${r.status}`);

  // 2. CORS preflight
  r = await request(app)
    .options("/api/auth/login")
    .set("Origin", "http://localhost:3000")
    .set("Access-Control-Request-Method", "POST");
  check(
    "CORS preflight → 204 with allow-origin http://localhost:3000",
    r.status === 204 && r.headers["access-control-allow-origin"] === "http://localhost:3000"
  );

  // 3. register validation
  r = await agent.post("/api/register").send({});
  check("register empty → 400", r.status === 400, JSON.stringify(r.body));
  check("register empty has success:false", r.body.success === false);

  // 4. register ok
  r = await agent.post("/api/register").send({
    fullName: "Suraj Kumar",
    Username: "suraj1",
    companyName: "TCS",
    mobile: "9876543210",
    email: "suraj1@example.com",
    password: "Passw0rd!",
  });
  check("register valid → 201", r.status === 201, JSON.stringify(r.body));
  check("register has success:true", r.body.success === true);
  check("register response has user.email", r.body.data?.user?.email === "suraj1@example.com");

  // 4b. register without username auto-generates one from full name
  r = await agent.post("/api/register").send({
    fullName: "John Doe",
    companyName: "Acme Corp",
    mobile: "9876543215",
    email: "john@acme.com",
    password: "Passw0rd!",
  });
  check("register auto-generated username → 201", r.status === 201, JSON.stringify(r.body));
  check("register auto-generated username starts with full name", /^john_doe\d+$/.test(r.body.data?.user?.username || ""));

  // 5. duplicate email
  r = await agent.post("/api/register").send({
    fullName: "Other User",
    Username: "other",
    companyName: "Wipro",
    mobile: "9876543211",
    email: "suraj1@example.com",
    password: "Passw0rd!",
  });
  check("register duplicate email → 400", r.status === 400);

  // 6. /api/auth/me without cookie
  r = await request(app).get("/api/auth/me");
  check("/api/auth/me anon → 200 user:null", r.status === 200 && r.body.data?.user === null);

  // 7. login wrong password
  r = await request(app).post("/api/auth/login").send({
    email: "suraj1@example.com",
    password: "wrong",
  });
  check("login wrong password → 401", r.status === 401);
  check("login wrong password has success:false", r.body.success === false);

  // 8. login ok
  r = await request(app).post("/api/auth/login").send({
    email: "suraj1@example.com",
    password: "Passw0rd!",
  });
  check("login OK → 200", r.status === 200, JSON.stringify(r.body));
  check("login has success:true", r.body.success === true);
  check("login returns role=Customer", r.body.data?.role === "Customer");
  const cookie = (Array.isArray(r.headers["set-cookie"]) ? r.headers["set-cookie"] : []).find((c: string) => c.startsWith("sp_session"));
  check("login sets sp_session cookie", !!cookie);
  check("cookie is httpOnly", !!cookie && /HttpOnly/i.test(cookie));

  // 8b. login with username (sent under the username field)
  r = await request(app).post("/api/auth/login").send({
    username: "suraj1",
    password: "Passw0rd!",
  });
  check("login with username → 200", r.status === 200, JSON.stringify(r.body));

  // 8c. username login is case-sensitive
  r = await request(app).post("/api/auth/login").send({
    username: "SURAJ1",
    password: "Passw0rd!",
  });
  check("login with wrong-case username → 401", r.status === 401);

  // 9. /api/auth/me with cookie
  const meAgent = request.agent(app);
  await meAgent.post("/api/auth/login").send({
    email: "suraj1@example.com",
    password: "Passw0rd!",
  });
  r = await meAgent.get("/api/auth/me");
  check(
    "/api/auth/me with cookie → user populated",
    r.status === 200 && r.body.data?.user?.email === "suraj1@example.com"
  );

  // 10. forgot/check-email
  r = await request(app).post("/api/forgot/check-email").send({
    method: "email",
    value: "suraj1@example.com",
  });
  check(
    "forgot/check-email registered → 200 exists:true",
    r.status === 200 && r.body.data?.exists === true,
    JSON.stringify(r.body)
  );

  r = await request(app).post("/api/forgot/check-email").send({
    method: "email",
    value: "nobody@nowhere.com",
  });
  check(
    "forgot/check-email unregistered → 200 exists:false",
    r.status === 200 && r.body.data?.exists === false,
    JSON.stringify(r.body)
  );

  // 10b. forgot/request
  r = await request(app).post("/api/forgot/request").send({
    method: "email",
    value: "suraj1@example.com",
  });
  check("forgot/request → 200", r.status === 200, JSON.stringify(r.body));
  check("mailer captured OTP", otpEmails.length === 1 && otpEmails[0].to === "suraj1@example.com");

  // 11. forgot/verify wrong
  r = await request(app).post("/api/forgot/verify").send({
    method: "email",
    value: "suraj1@example.com",
    otp: "000000",
  });
  check("forgot/verify wrong OTP → 400", r.status === 400);

  // 12. forgot/verify correct
  r = await request(app).post("/api/forgot/verify").send({
    method: "email",
    value: "suraj1@example.com",
    otp: "123456",
  });
  check("forgot/verify correct OTP → 200", r.status === 200 && r.body.data?.verified === true);

  // 13. forgot/reset
  r = await request(app).post("/api/forgot/reset").send({
    method: "email",
    value: "suraj1@example.com",
    otp: "123456",
    newPassword: "NewPassw0rd!",
  });
  check("forgot/reset → 200", r.status === 200);

  // 14. login with new password
  r = await request(app).post("/api/auth/login").send({
    email: "suraj1@example.com",
    password: "NewPassw0rd!",
  });
  check("login with new password → 200", r.status === 200);

  // 15. login with old password fails
  r = await request(app).post("/api/auth/login").send({
    email: "suraj1@example.com",
    password: "Passw0rd!",
  });
  check("login with old password → 401", r.status === 401);

  // 16. logout clears cookie
  r = await meAgent.post("/api/auth/logout");
  check("logout → 200", r.status === 200);
  const expiredCookie = (Array.isArray(r.headers["set-cookie"]) ? r.headers["set-cookie"] : []).find((c: string) => c.startsWith("sp_session"));
  check("logout expires sp_session cookie", !!expiredCookie && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(expiredCookie));

  // 17. support user creation
  r = await request(app).post("/api/support").send({
    Username: "support_pro",
    companyName: "Sharpminds",
    mobile: "9888888888",
    email: "support@sharpminds.com",
    password: "Support@456",
  });
  check("create support user → 201", r.status === 201, JSON.stringify(r.body));
  check("create support user has success:true", r.body.success === true);
  check("create support user created:true", r.body.data?.created === true);
  check("create support user returns camelCase username", r.body.data?.user?.username === "support_pro");

  // 18. creating the same support user again updates it (upsert)
  r = await request(app).post("/api/support").send({
    Username: "support_pro",
    companyName: "Sharpminds",
    mobile: "9888888888",
    email: "support@sharpminds.com",
    password: "Support@789",
  });
  check("update existing support user → 200", r.status === 200);
  check("update existing support user created:false", r.body.data?.created === false);

  // 19. register returns camelCase username
  r = await agent.post("/api/register").send({
    fullName: "Camel Case",
    Username: "camelcase_user",
    companyName: "TCS",
    mobile: "9876543222",
    email: "camelcase@example.com",
    password: "Passw0rd!",
  });
  check("register response uses camelCase username", r.body.data?.user?.username === "camelcase_user");

  // 20. unknown route
  r = await request(app).get("/api/nope");
  check("unknown route → 404", r.status === 404);

  // ---------- print ----------
  console.log("Results:\n");
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail && !r.ok ? "  →  " + r.detail : ""}`);
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("test crashed:", e);
  process.exit(2);
});