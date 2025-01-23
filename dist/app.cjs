"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 1) Adjust imports so fetchCandyMachine is actually pulled from mpl-core-candy-machine
const { Metaplex } = require("@metaplex-foundation/js");
const { Keypair, Connection } = require("@solana/web3.js"); // Need Keypair to partialSign
// const { Keypair } = require("@solana/web3.js");

// -------------------- Log the Candy Machine library version (optional) --------------------
const candyMachinePkg = require("@metaplex-foundation/mpl-core-candy-machine/package.json");
console.log("Candy Machine Library Version =>", candyMachinePkg.version);

const {
  createUmi,
  keypairIdentity,
  generateSigner,
  transactionBuilder,
  some,
  sol,
  publicKey
} = require("@metaplex-foundation/umi");
const {
  createUmi: createUmiBundleDefaults,
  fetchDigitalAsset,
  mintV1
} = require("@metaplex-foundation/umi-bundle-defaults");
const {
  mplCandyMachine,
  create,
  addConfigLines,
  fetchCandyMachine
} = require("@metaplex-foundation/mpl-core-candy-machine");
const { toWeb3JsTransaction } = require("@metaplex-foundation/umi-web3js-adapters");
const { setComputeUnitLimit } = require("@metaplex-foundation/mpl-toolbox");
// const { Connection } = require("@solana/web3.js");

// 1) Create a Umi instance & set a server identity
const umi = createUmiBundleDefaults("https://api.devnet.solana.com")
  .use(mplCandyMachine());

const serverKeypair = generateSigner(umi);
umi.use(keypairIdentity(serverKeypair));
console.log("Server Identity Pubkey =>", serverKeypair.publicKey.toString());

// Store references to new Candy Machine and collection
let newCandyMachine;
let newCollectionMint;

/**
 * Build & serialize the Candy Machine creation transaction
 */
async function buildAndSerializeCandyMachineTx({ phantomWalletPubkey }) {
  try {
    console.log("Incoming phantomWalletPubkey =>", phantomWalletPubkey);

    if (!phantomWalletPubkey) {
      throw new Error("phantomWalletPubkey is missing or undefined!");
    }

    const phantomPayerPk = publicKey(phantomWalletPubkey);
    console.log("Parsed phantomPayerPk =>", phantomPayerPk.toString());

    // Generate new signers
    const candyMachineSigner = generateSigner(umi);
    const collectionMintSigner = generateSigner(umi);
    console.log("Candy Machine Pubkey =>", candyMachineSigner.publicKey.toString());
    console.log("Collection Mint Pubkey =>", collectionMintSigner.publicKey.toString());

    // Fetch a blockhash
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const { blockhash } = await connection.getLatestBlockhash();
    console.log("Fetched blockhash =>", blockhash);

    // Additional logs
    console.log("Candy Machine authority =>", serverKeypair.publicKey.toString());
    console.log("Candy Machine collectionUpdateAuthority =>", serverKeypair.publicKey.toString());
    const solPaymentDestination = serverKeypair.publicKey;
    console.log("Candy Machine solPayment destination =>", solPaymentDestination.toString());

    // Prepare Candy Machine creation instructions
    const createBuilder = await create(umi, {
      candyMachine: candyMachineSigner,
      collection: collectionMintSigner.publicKey,
      collectionUpdateAuthority: serverKeypair.publicKey,
      authority: serverKeypair.publicKey,
      itemsAvailable: 10,
      isMutable: false,
      configLineSettings: some({
        prefixName: "My NFT #",
        nameLength: 10,
        prefixUri: "https://example.com/",
        uriLength: 26,
        isSequential: false,
      }),
      guards: {
        botTax: some({ lamports: sol(0.001), lastInstruction: true }),
        solPayment: some({
          lamports: sol(1.0),
          destination: solPaymentDestination,
        }),
      },
    });

    // Optionally, add config lines
    console.log("addConfigLines CandyMachine =>", candyMachineSigner.publicKey.toString());
    const configLinesBuilder = await addConfigLines(umi, {
      candyMachine: candyMachineSigner.publicKey,
      index: 0,
      configLines: [
        { name: "1", uri: "1.json" },
        { name: "2", uri: "2.json" },
      ],
    });

    // --------------------------------------------------------------------
    // Key Change: Instead of using .setFeePayer(phantomPayerPk),
    // use the serverKeypair so the server covers transaction fees.
    // --------------------------------------------------------------------
    const combinedBuilder = transactionBuilder()
      .add(createBuilder)
      .add(configLinesBuilder)
      .add(setComputeUnitLimit(umi, { units: 800_000 }));

    console.log("Building transaction now...");
    const builtTx = await combinedBuilder.buildWithLatestBlockhash(umi);
    console.log("Transaction built successfully");

     // Convert to a VersionedTransaction
     const web3Tx = toWeb3JsTransaction(builtTx);

      // The server is the Candy Machine authority => we partialSign as authority using the standard @solana/web3.js Keypair
      const serverKeypairWeb3 = Keypair.fromSecretKey(serverKeypair.secretKey);
      web3Tx.sign([serverKeypairWeb3]);
     
         // Now the transaction includes the server's signature, but still needs the Phantom fee payer signature
         const serialized = Buffer.from(
           web3Tx.serialize({ requireAllSignatures: false })
         ).toString("base64");
     
    // // Convert to web3.js Transaction & serialize
    // const web3Tx = toWeb3JsTransaction(builtTx);
    // const serialized = Buffer.from(
    //   web3Tx.serialize({ requireAllSignatures: false })
    // ).toString("base64");

    // Store references
    newCandyMachine = candyMachineSigner;
    newCollectionMint = collectionMintSigner;

    console.log("Candy Machine creation transaction built & serialized successfully");
    return { serialized };
  } catch (error) {
    console.error("Error in buildAndSerializeCandyMachineTx:", error);
    throw error;
  }
}

// Create a second connection just for Metaplex demo 
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const walletKeypair = Keypair.generate(); // or load from file

// Initialize Metaplex
const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(walletKeypair));

async function createCandyMachineViaMetaplex() {
  // Example from the Metaplex docs
  try {
    const { candyMachine, transactionId } = await metaplex
      .candyMachines()
      .create({
        itemsAvailable: 10,
        sellerFeeBasisPoints: 500,
        // other Candy Machine options...
      });

    console.log("Created Candy Machine:", candyMachine.address.toBase58());
    console.log("Transaction ID:", transactionId);
  } catch (e) {
    console.error("Error in createCandyMachineViaMetaplex =>", e);
  }
}

/**
 * Mints an NFT from the previously created Candy Machine.
 * Requires that newCandyMachine and newCollectionMint are set (from create route).
 */
async function mintCandyMachineNft({ phantomWalletPubkey }) {
  try {
    if (!phantomWalletPubkey) {
      throw new Error("Missing user pubkey for the mint transaction");
    }

    // Ensure fetchCandyMachine is actually imported (see added import above).
    // Now we can safely call fetchCandyMachine below.

    if (!newCandyMachine) {
      throw new Error("No Candy Machine is set. Please call create-candy-machine first.");
    }

    // Grab on-chain data for confirmation/ debugging
    const candyMachineAccount = await fetchCandyMachine(umi, newCandyMachine.publicKey);
    console.log("Candy Machine itemsAvailable =>", candyMachineAccount.itemsAvailable);

    // Create a new signer for the minted NFT
    const assetSigner = generateSigner(umi);

    // Build the Mint transaction for Candy Machine
    const mintBuilder = transactionBuilder()
      // Optionally set compute units if needed
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        mintV1(umi, {
          candyMachine: newCandyMachine.publicKey,
          asset: assetSigner,
          collection: newCollectionMint.publicKey,
          // If you have guard(s):
          mintArgs: {
            solPayment: some({
              destination: serverUmiSigner.publicKey, // The server or your own wallet, etc.
            })
          },
        })
      );

    // Send + confirm the mint transaction
    const txSignature = await mintBuilder.sendAndConfirm(umi, {
      send: { skipPreflight: false },
      confirm: { commitment: "finalized", maxRetries: 5 },
    });

    console.log("Mint transaction confirmed =>", txSignature);

    // Get on-chain data about the newly minted NFT
    const mintedNftAcc = await fetchDigitalAsset(umi, assetSigner.publicKey);

    // Build a summary
    const mintedInfo = {
      mintedNftPubkey: assetSigner.publicKey.toString(),
      candyMachinePubkey: newCandyMachine.publicKey.toString(),
      mintedBy: phantomWalletPubkey,
      transactionSignature: txSignature,
      nftData: {
        supply: Number(mintedNftAcc.supply),
        name: mintedNftAcc.name,
        symbol: mintedNftAcc.symbol,
        uri: mintedNftAcc.uri,
      },
      mintedAt: new Date().toISOString(),
    };

    // (Optional) Write minted details to a local file
    const folderPath = path.join(__dirname, "minted_nfts");
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const filePath = path.join(folderPath, `mint_${assetSigner.publicKey.toString()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(mintedInfo, null, 2));
    console.log("Wrote minted NFT info =>", filePath);

    return {
      message: "NFT minted successfully",
      mintedNft: mintedInfo,
      transactionSignature: txSignature,
    };
  } catch (err) {
    console.error("Error in mintCandyMachineNft:", err);
    console.log("Minting from Candy Machine Address =>", newCandyMachine.publicKey.toString());

    throw err;
  }
}

// 2) Export it if you want to call from server.js
module.exports = {
  buildAndSerializeCandyMachineTx, // your existing Umi-based function
  createCandyMachineViaMetaplex,   // the new Metaplex-based function
  mintCandyMachineNft,
};