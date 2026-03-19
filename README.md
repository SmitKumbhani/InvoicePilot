# InvoicePilot

## Ngrok Forwarding (Docker)

The `frontend` container now includes `ngrok` and starts a tunnel automatically when `NGROK_AUTHTOKEN` is provided.

### 1) Set environment variables

Create a `.env` file in the project root:

```env
NGROK_AUTHTOKEN=your_ngrok_authtoken
# Optional: reserved ngrok domain
# NGROK_DOMAIN=your-reserved-subdomain.ngrok.app
```

### 2) Start containers

```bash
docker compose up -d --build
```

### 3) Check tunnel

- Frontend local: `http://localhost:9002`
- Ngrok inspector: `http://localhost:4040`
- Public URL is shown in frontend container logs and in ngrok inspector.
