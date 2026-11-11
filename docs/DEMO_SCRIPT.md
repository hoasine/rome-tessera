# Tessera demo script

Target length: about 2 minutes. Use two devices: a laptop as the organizer, a phone or second browser as the attendee.

## Preparation

1. Open the deployed Tessera app.
2. Have MetaMask on Rome Hadrian and Solflare on Devnet, each with a little test gas.

## Recording

### 1. The idea (15 s)

"Tessera is check-in for both wallet worlds. One QR code at the door, and MetaMask and Solflare users get the same badge from one contract on Rome."

### 2. Create an event (30 s)

On the laptop, connect MetaMask, choose "Create an event", set a name, a one-hour window, and a capacity of 50, and sign. The event page opens with the organizer QR code.

### 3. Check in with MetaMask (25 s)

Scan the QR code, connect MetaMask, choose "Claim my badge", and sign. Show the success message and the passport page.

### 4. Check in with Solflare (30 s)

Scan again in a browser with Solflare, connect it, and claim. Back on the event page, point at the purple Solana segment: "This attendee is counted as Solana because the contract checked the sender against their Solana public key."

### 5. Why it is safe (20 s)

"The QR key signs each attendee's own address, so nobody can copy a claim onto another wallet. If the code leaks, I rotate it, and the old one stops working." Press "Rotate QR code".
