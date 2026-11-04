# Deploying cNGN Canton to Linux VM (`ayoseun@102.209.46.148`)

This guide walks through deploying Canton and the cNGN smart contracts onto your Linux Virtual Machine.

---

## Quick Start (Automated Installation)

### Step 1: SSH into your VM
From your Mac terminal:
```bash
ssh ayoseun@102.209.46.148
```

### Step 2: Clone or Copy the Repository
If you haven't cloned the repository on your VM yet:
```bash
git clone https://github.com/Ayoseun/stablecoin-cngn.git
cd stablecoin-cngn/canton-contract
git checkout sui  # or the relevant branch
```

*(Alternatively, copy the folder directly from your Mac to the VM:)*
```bash
scp -r /Users/ayoseun/Documents/GitHub/Convexity/stablecoin-cngn/canton-contract ayoseun@102.209.46.148:~/
```

### Step 3: Run the Automated VM Setup
On the VM, run:
```bash
chmod +x scripts/vm-install.sh
./scripts/vm-install.sh
```

This script will automatically:
1. Install Java 17, `make`, `netcat`, and dependencies.
2. Install the Daml SDK (`2.10.4`).
3. Compile the cNGN DAR package (`cngn-1.0.0.dar`).
4. Start the Canton participant ledger on port `6865`.
5. Upload the DAR and execute `Setup:initialize` (allocating Owner, Minter, Relayer parties and creating initial compliance registries).

---

## Running Action Demos on the VM

Once deployed, you can run any of the end-to-end flows directly on the VM:

```bash
# Mint proposal + execution
make demo-mint

# Issue and transfer holdings
make demo-transfer

# Issue and burn holdings
make demo-burn

# Run all demos in sequence
make demo-all

# List all parties allocated on the ledger
make list-parties
```

---

## 24/7 Production Background Service (Systemd)

To ensure Canton automatically restarts if it crashes or the VM reboots:

1. Copy the systemd service file:
   ```bash
   sudo cp scripts/canton.service /etc/systemd/system/canton.service
   ```
2. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable canton
   sudo systemctl start canton
   ```
3. Check service status and logs:
   ```bash
   sudo systemctl status canton
   journalctl -u canton -f
   ```

---

## Accessing the Ledger API from your Mac

Canton's Ledger API listens on port `6865`. To interact with the VM ledger from your local Mac without exposing port 6865 to the public internet:

### Secure SSH Tunnel (Recommended):
From your local Mac terminal:
```bash
ssh -L 6865:localhost:6865 ayoseun@102.209.46.148
```
Now, any local Daml tool or script running on your Mac targeting `localhost:6865` will securely communicate with the Canton ledger on your VM!
