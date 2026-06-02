# Angel One SmartAPI Tester Dashboard 📈

A modern, high-fidelity, and secure standalone testing dashboard designed to verify **Angel One SmartAPI** login, REST endpoints, and WebSocket 2.0 streaming connectivity before integrating them into production environments.

Inspired by trading platforms like TradingView, Zerodha Kite, and Groww, the interface is fully dark-themed and glassmorphic, offering real-time charting, interactive REST diagnostic sandboxes, visual WebSocket heartbeats, and live transaction log viewers.

---

## Key Features

1. **Dynamic MFA Session Handshake**: Automatically generates 6-digit TOTP codes using local `otplib` engines from your Base32 secret key, validating MPIN and passwords directly with Angel One servers.
2. **Reverse Proxy Isolation**: Stores all sensitive API Keys, Clients IDs, and MPINs in backend `.env` files. Raw secrets are *never* returned to the client; only masked configurations are exposed, preventing accidental leaks.
3. **Dedicated MCX Live Tracker**: Streams commodity tickers (Gold and Crude Oil Futures) dynamically with visual price flashing and live Area Charts (powered by Recharts).
4. **Interactive REST Test Sandbox**: One-click triggers for Login, Profile, quotes, and 1-minute historical OHLC candle data, displaying raw, copyable JSON responses and round-trip times (RTT).
5. **WebSocket Feed Decapsulator**: Displays visual latency tickers, ping/pong heartbeats, reconnect logs, and raw binary frames decapsulated into structured JSON feeds.
6. **Unified Logging Console**: Rolling transaction logs (API Requests, API Responses, WebSocket events, and Errors) rendered live with expandable details drawer and type-filters.
7. **Dynamic Simulator Mode**: Automatically activates a simulated, high-fidelity mock stream if the market is closed or API credentials are not yet entered. This lets developers test charting and UI rendering at any time of day.

---

## Folder Structure

```
/Users/suryasaketh/myprojects/mcx/
├── backend/
│   ├── src/
│   │   ├── index.js             # Express app & WebSocket server
│   │   ├── config.js            # Configuration & .env manager
│   │   ├── logger.js            # Centralized system logger (ring buffer)
│   │   └── smartapi.js          # Custom SmartAPI REST and WebSocket wrapper
│   ├── .env.example             # Template for variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable cards, navigation, layout
│   │   ├── hooks/               # Custom hooks (shared useWebSocket)
│   │   ├── pages/               # Dashboard, MCX, API, WS, Search, Settings, Logs
│   │   ├── App.tsx              # Routing and layouts
│   │   ├── index.css            # Custom CSS & Tailwind variables
│   │   └── main.tsx
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
├── Dockerfile.backend           # Node production execution
├── Dockerfile.frontend          # Nginx production proxy build
├── nginx.conf                   # Custom reverse proxy configuration
├── docker-compose.yml           # Multi-container orchestration
└── README.md                    # Setup and deployment manual
```

---

## Installation & Local Development

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher
- **NPM**: `v9.0.0` or higher

### 2. Manual Installation
Clone this repository to your local computer and install dependencies:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Run Development Servers
Start both servers concurrently to enable dynamic reloading:

```bash
# Start backend Express proxy (Runs on port 5001)
cd backend
npm run dev

# Start frontend Vite server (Runs on port 3000)
# Open another terminal window:
cd frontend
npm run dev
```

*Navigate to [http://localhost:3000](http://localhost:3000) in your browser.*

---

## Docker Setup (Single-Port Orchestration)

Both containers are configured to build and bundle in an industry-standard production setup. Nginx hosts compiled static React files and reverse-proxies `/api` and `/ws` streams to the Node.js Express server on port `80`.

To start the Docker containers:

```bash
# Run from the root directory
docker-compose up --build -d
```

- **Frontend Access**: [http://localhost:3000](http://localhost:3000)
- **Backend API Access**: [http://localhost:5001](http://localhost:5001)

Credentials saved on the settings page are stored dynamically inside `./backend/.env` which is mounted as a persistent volume, meaning configuration survives container restarts!

---

## AWS Production Deployment Guide

We recommend three primary methods for deploying this sandbox to AWS securely:

### Option A: AWS Lightsail / EC2 (Easiest and most cost-effective)
1. **Provision Instance**: Launch an Amazon Linux 2 or Ubuntu instance on EC2 (t3.micro is sufficient). Ensure ports `80` (HTTP) and `22` (SSH) are open in your Security Group.
2. **Install Docker & Git**:
   ```bash
   sudo yum update -y
   sudo amazon-linux-extras install docker -y
   sudo service docker start
   sudo systemctl enable docker
   sudo usermod -a -G docker ec2-user
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.22.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   sudo yum install git -y
   ```
3. **Deploy**:
   ```bash
   git clone <your-repository-url> mcx-tester
   cd mcx-tester
   docker-compose up --build -d
   ```

### Option B: AWS ECS Fargate (Production-Grade Serverless Containerization)
For highly resilient serverless hosting, use AWS Elastic Container Service (ECS) with Fargate:
1. **Container Registry**: Build and push Docker images to AWS ECR:
   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com

   # Build and Tag
   docker build -t smartapi-backend -f Dockerfile.backend .
   docker tag smartapi-backend:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/smartapi-backend:latest
   docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/smartapi-backend:latest

   docker build -t smartapi-frontend -f Dockerfile.frontend .
   docker tag smartapi-frontend:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/smartapi-frontend:latest
   docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/smartapi-frontend:latest
   ```
2. **ECS Task Definition**: Define a Fargate task mapping the two containers:
   - Mount an EFS volume to the backend task at `/usr/src/app` to persist `.env` credential changes.
   - Configure container dependencies so the `frontend` container depends on `backend`.
3. **Application Load Balancer (ALB)**: Set up an ALB exposing port `80` (routing to the frontend Nginx) and support secure HTTPS `443` using AWS Certificate Manager (ACM). Ensure WebSocket upgrade routing headers (`Upgrade`, `Connection`) are supported by your target group to keep the stream running smoothly.

---

## Security Compliance

This tester complies fully with Angel One SmartAPI security protocols:
- **No Client Exposure**: Raw passwords, API private keys, and TOTP Secrets are never sent to the browser.
- **Dynamic TOTP**: TOTP codes are generated on-the-fly inside Node.js using standard `otplib` base32 calculations, preventing token replay attacks.
- **Masked Data Outputs**: Masked settings fields prevent session sniffing.
- **Rolling Logs Ring Buffer**: Keeps logs in an ephemeral memory ring buffer, limiting leaks from physical storage drives on multi-tenant nodes.
