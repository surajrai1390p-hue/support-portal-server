# Customer Support Portal Server

Backend API for the **Customer Support Portal** developed during the **Sharp Minds Cloud Tech Pvt. Ltd. Internship Program 2026**.

The Customer Support Portal is designed to provide customers of **MSME Sales Booster ERP** with a centralized platform to raise support requests, communicate with the support team, upload supporting documents, and track the status of their complaints without relying on phone calls or emails.

This application will initially function as a standalone platform and will later be integrated into the MSME Sales Booster ERP.

---

# Problem Statement

Customers currently depend on phone calls, emails, or WhatsApp to report issues related to the ERP. This makes it difficult to track service requests, monitor response times, and maintain complete communication history.

The objective of this project is to develop a **Customer Support Portal** where customers can raise support tickets, communicate with the support team, upload attachments, and track the progress of their requests in real time.

---

# Technology Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT Authentication
- Bcrypt
- Multer
- Dotenv

---

# Installation

Clone the repository

```bash
git clone https://github.com/surajrai1390p-hue/support-portal-server.git
```

Navigate to the project

```bash
cd support-portal-server
```

Install dependencies

```bash
npm install
```

Create a `.env` file (copy the provided example)

```bash
copy .env.example .env
```

Fill in the values in `.env`:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port the Express server listens on | `5000` |
| `CLIENT_ORIGIN` | Frontend origin allowed by CORS | `http://localhost:3000` |
| `MONGO_URI` | MongoDB connection string | — |
| `JWT_SECRET` | Secret used to sign JWT session tokens | — |
| `OTP_EXPIRY_MINUTES` | Minutes before an OTP expires | `5` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port (587 TLS / 465 SSL) | `587` |
| `EMAIL_USER` | Gmail account used as sender | — |
| `EMAIL_PASS` | Gmail App Password for the sender | — |
| `EMAIL_FROM_NAME` | Display name shown to recipients | `Support Portal` |
| `SUPPORT_STAFF_EMAIL` | Support inbox that receives notifications | — |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials for S3 uploads | — |
| `AWS_REGION` / `AWS_S3_BUCKET_NAME` | S3 region and bucket for attachments | — |

Run the development server

```bash
npm run dev
```

The server will start at

```
http://localhost:5000
```

---

# Folder Structure

```
src

├── app.ts
│
├── config
│
├── constants
│
├── controllers
│
├── interfaces
│
├── middleware
│
├── models
│
├── routes
│
├── services
│
├── types
│
└── utils
```

---

# User Roles

## Administrator

Administrator can

- Login
- View all Tickets
- Assign Tickets
- Reply to Customers
- Change Ticket Status
- Close Tickets
- Reopen Tickets
- View Ticket History
- Search Tickets

---

## Customer

Customer can

- Login
- Raise Support Ticket
- View My Tickets
- Reply to Ticket
- Upload Attachments
- Cancel Ticket
- Track Ticket Status

---

# Modules

The backend will provide REST APIs for

- Authentication
- Users
- Support Tickets
- Ticket Replies
- Ticket Attachments
- Dashboard

---

# Ticket Status

Each support ticket should support the following workflow.

```
Open

Assigned

In Progress

Waiting for Customer

Resolved

Closed

Cancelled
```

---

# Ticket Priority (From previous discussions, we decided to remove priority from ticket creation because every complaint is highest prority to support team)

```
Low

Medium

High

Critical
```

---

# Ticket Categories(Based on Last meeting mentor told us to create only one category that is "Sales" and sub category for sales.)

Initially, the system should support the following categories.

- Inquiry
- Quotation
- Customer Order
- Sales Invoice
- Purchase
- Inventory
- Production
- Accounts
- General Support

---

# Ticket Information(No Priority in Ticket and also no assignment to any engineer.)

Each ticket should contain

- Ticket Number
- Subject
- Description
- Category
- Priority
- Status
- Customer
- Assigned Support Engineer
- Created Date
- Updated Date

---

# Attachments

Customers should be able to upload

- Images
- PDF Documents
- Videos

---

# Ticket Conversation(only one support person for this project)

Each ticket should maintain a complete communication history between the customer and the support team.

Example

```
Customer

↓

Support Engineer

↓

Customer

↓

Support Engineer

↓

Ticket Closed
```

---

# Dashboard ()

Administrator Dashboard

- Total Tickets
- Open Tickets
- In Progress Tickets
- Waiting for Customer
- Resolved Tickets
- Closed Tickets

Customer Dashboard

- Total Tickets
- Open Tickets
- Resolved Tickets
- Recently Updated Tickets

---

# Database Collections (one extra schema "Audit log" track all changes in tickets throughout portal)

The application should initially contain the following collections.

- Users
- Tickets
- TicketReplies
- TicketAttachments (is combine with Tickets schema)

---

# API Response Format

All APIs should return a standard response.

Success

```json
{
  "success": true,
  "message": "Ticket created successfully.",
  "data": {}
}
```

Failure

```json
{
  "success": false,
  "message": "Ticket not found."
}
```

---

# Coding Standards

- Use TypeScript.
- Follow REST API principles.
- Keep controllers lightweight.
- Place business logic inside services.
- Validate incoming requests.
- Use async/await.
- Write reusable code.
- Use meaningful variable and function names.
- Avoid duplicate code.

---

# Git Workflow

Do **NOT** commit directly to the `main` branch.

Create a feature branch before starting development.

Example

```bash
git checkout -b feature/ticket-management
```

After completing your work

```bash
git add .

git commit -m "Implemented Ticket Management APIs"

git push origin feature/ticket-management
```

Create a Pull Request for review.

---

# Commit Message Examples

Good

```
Implemented Authentication APIs

Created Ticket Module

Added Ticket Reply APIs

Implemented Attachment Upload

Created Dashboard APIs

Implemented Ticket Assignment

Added Ticket Search APIs
```

Avoid

```
Done

Final

Update

Testing

abc
```

---

# Team Expectations

Every intern is expected to

- Write clean and readable code.
- Follow the project architecture.
- Commit code regularly.
- Use feature branches.
- Raise Pull Requests.
- Participate in code reviews.
- Keep documentation updated.
- Work collaboratively with team members.

---

# Deliverables( Ticket assignment not included)

By the end of the internship, the backend should support

- User Authentication
- Ticket Management
- Ticket Conversation
- File Upload APIs
- Ticket Assignment
- Dashboard APIs
- Search APIs
- MongoDB Integration
- Role-based Authorization

---

# Future Scope

The Customer Support Portal will later be integrated into the **MSME Sales Booster ERP**, allowing customers to raise and track support tickets directly from within the ERP without contacting the support team separately.

Future enhancements may include

- Email Notifications
- Push Notifications
- SLA Management
- Customer Feedback
- Knowledge Base Integration
- Live Chat
- Jira Integration
- Analytics & Reports

---

# Maintained By

**Sharp Minds Cloud Tech Pvt. Ltd.**

**MSME Sales Booster ERP Team**

**Internship Program 2026**
