const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const {
  buildAndSerializeCandyMachineTx,
  createCandyMachineViaMetaplex,
  mintCandyMachineNft,
} = require('./dist/app.cjs');

const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/create-candy-machine', async (req, res) => {
  try {
    const { userPubkey } = req.body;
    console.log("Incoming userPubkey =>", userPubkey);

    if (!userPubkey) {
      throw new Error("Missing userPubkey (undefined or empty)!");
    }

    if (userPubkey.length !== 44 && userPubkey.length !== 43) {
      throw new Error('Invalid public key format');
    }

    const { serialized } = await buildAndSerializeCandyMachineTx({
      phantomWalletPubkey: userPubkey
    });

    res.json({
      message: "Candy Machine creation transaction built successfully",
      transaction: serialized
    });
  } catch (error) {
    console.error('Error in /create-candy-machine:', error);
    res.status(500).json({
      error: 'Candy machine creation failed',
      details: error.message
    });
  }
});
// NEW: Mint from Candy Machine endpoint
app.post("/mint-candy-machine", async (req, res) => {
  try {
    const { userPubkey } = req.body;
    console.log("Incoming userPubkey =>", userPubkey);

    const minted = await mintCandyMachineNft({ phantomWalletPubkey: userPubkey });
    res.json(minted);
  } catch (error) {
    console.error("Minting from Candy Machine failed:", error);
    res.status(500).json({
      error: "Minting from Candy Machine failed",
      details: error.message,
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
