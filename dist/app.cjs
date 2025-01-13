"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const { 
  createUmi, 
  signerIdentity,
  generateSigner,
  transactionBuilder,
  some,
  sol,
  publicKey
} = require("@metaplex-foundation/umi");
const {
  createUmi: createUmiBundleDefaults
} = require("@metaplex-foundation/umi-bundle-defaults");
const {
  mplCandyMachine,
  create,
  addConfigLines,
} = require("@metaplex-foundation/mpl-core-candy-machine");

const { toWeb3JsTransaction } = require("@metaplex-foundation/umi-web3js-adapters");
const { setComputeUnitLimit } = require("@metaplex-foundation/mpl-toolbox");
const { Keypair, PublicKey, VersionedTransaction, TransactionMessage } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// 1) Umi instance on devnet
const umi = createUmiBundleDefaults("https://api.devnet.solana.com")
  .use(mplCandyMachine());

// 2) Load a JSON array from a local file
const keypairPath = path.join(__dirname, "PhantomWallet.json"); 
const rawData = fs.readFileSync(keypairPath, "utf8"); // e.g. "[135,52, ... ,22]"
const secretKeyArray = JSON.parse(rawData); // convert JSON string -> array

// 3) Convert array -> Uint8Array
const secretKey = Uint8Array.from(secretKeyArray);

// 4) Now fromSecretKey(...) is valid
const serverKeypair = Keypair.fromSecretKey(secretKey);
// Then wrap in a Umi-compatible Signer if needed:
const serverUmiSigner = {
  publicKey: publicKey(serverKeypair.publicKey),
  secretKey: Uint8Array.from(serverKeypair.secretKey),
};

// 5) Let Umi know the server is the authority signer
umi.use(signerIdentity(serverUmiSigner));

async function buildAndSerializeCandyMachineTx({ phantomWalletPubkey }) {
  try {
    if (!phantomWalletPubkey) {
      throw new Error("phantomWalletPubkey is missing or undefined!");
    }
    const phantomPayerPk = new PublicKey(phantomWalletPubkey);

    // Log the public key being used
    console.log("Phantom Payer Public Key:", phantomPayerPk.toString());

    // Candy Machine and Collection signers
    const candyMachineSigner = generateSigner(umi);
    const collectionMintSigner = generateSigner(umi);

    // Build the Candy Machine instructions
    const createBuilder = await create(umi, {
      candyMachine: candyMachineSigner,
      collection: collectionMintSigner.publicKey,
      collectionUpdateAuthority: serverUmiSigner.publicKey,
      authority: serverUmiSigner.publicKey,
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
          lamports: sol(1),
          destination: serverUmiSigner.publicKey,
        }),
      },
    });

    // Optionally add config lines
    const configLinesBuilder = await addConfigLines(umi, {
      candyMachine: candyMachineSigner.publicKey,
      index: 0,
      configLines: [
        { name: "1", uri: "1.json" },
        { name: "2", uri: "2.json" },
      ],
    });

    // Build the transaction
    const combinedBuilder = transactionBuilder()
      .add(createBuilder)
      .add(configLinesBuilder)
      .add(setComputeUnitLimit(umi, { units: 800_000 }));

    const builtTx = await combinedBuilder.buildWithLatestBlockhash(umi);

    // Convert to a VersionedTransaction
    let web3Tx = toWeb3JsTransaction(builtTx);

    // Log the transaction before signing
    console.log("Transaction before signing:", web3Tx);

    // The server partial-signs as authority
    const serverKeypairWeb3 = serverKeypair; // Already a Keypair
    web3Tx.sign([serverKeypairWeb3]);

    // Log the transaction after signing
    console.log("Transaction after signing:", web3Tx);

    // Recompile the transaction with "payerKey = phantomPayerPk"
    const originalMsg = TransactionMessage.decompile(web3Tx.message);
    const userMsg = new TransactionMessage({
      payerKey: phantomPayerPk,
      recentBlockhash: builtTx.blockhash,
      instructions: originalMsg.instructions,
    }).compileToV0Message();

    let versionedTransaction = new VersionedTransaction(userMsg);

    // Re-sign with server authority
    versionedTransaction.sign([serverKeypairWeb3]);

    // Log the final transaction
    console.log("Final Versioned Transaction:", versionedTransaction);

    // Serialize for the client
    const serialized = Buffer.from(
      versionedTransaction.serialize({ requireAllSignatures: false })
    ).toString("base64");

    // Log the serialized transaction
    console.log("Serialized Transaction (Base64):", serialized);

    return {
      message: "Candy Machine transaction built, user set as fee payer",
      transaction: serialized,
    };
  } catch (error) {
    console.error("Error building Candy Machine creation transaction:", error);
    throw error;
  }
}

module.exports = {
  buildAndSerializeCandyMachineTx
};