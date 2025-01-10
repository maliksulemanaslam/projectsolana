import { useRef, useState, useEffect } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { VersionedTransaction, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';


import "../App.css";
import logo from "../assets/images/CE logo-01.png";
import img1 from "../assets/images/Group 109.png";
import img2 from "../assets/images/Group 110.png";
import img3 from "../assets/images/Group 111.png";
import img4 from "../assets/images/Mask Group 4.png";
import img5 from "../assets/images/opensea-logo-1.png";
import video from "../assets/images/Celestial Empires_1920x1080.mp4";
import avt from "../assets/images/metacooler_design_Comic_book_style_Strong_Black_outline_image_o_3c7be38d-9097-4a16-bb4f-82120566370e.webp";

// Helper function to convert base64 to Uint8Array
function base64ToUint8Array(base64String) {
    const binary = window.atob(base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Function to log wallet balance
const logWalletBalance = async (walletAddress) => {
    try {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const publicKey = new PublicKey(walletAddress);
        const balance = await connection.getBalance(publicKey);
        console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
    }
};

function Header() {
    const navRef = useRef();
    const [timeLeft, setTimeLeft] = useState(172800);
    const [isButtonVisible, setIsButtonVisible] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [wallet, setWallet] = useState(null);

    const showNavbar = () => {
        navRef.current.classList.toggle("responsive_nav");
    };

    const handleNavLinkClick = () => {
        if (navRef.current.classList.contains("responsive_nav")) {
            showNavbar();
        }
    };

    const handleConnectWallet = () => {
        setShowModal(true);
    };

    const handleWalletClick = async (walletType) => {
        if (walletType === 'Phantom' && window.solana && window.solana.isPhantom) {
            try {
                const response = await window.solana.connect();
                setWallet(response.publicKey);
                console.log('Connected with public key:', response.publicKey.toString());
                await logConnection(walletType, 'connected successfully');
                await logWalletBalance(response.publicKey.toString());
            } catch (err) {
                console.error('Connection failed:', err);
            }
        } else if (walletType === 'Solflare') {
            const solflare = new SolflareWalletAdapter();
            if (solflare.connected) {
                setWallet(solflare.publicKey);
                console.log('Solflare already connected');
                await logConnection(walletType, 'already connected');
                await logWalletBalance(solflare.publicKey.toString());
            } else {
                try {
                    await solflare.connect();
                    setWallet(solflare.publicKey);
                    console.log('Connected with public key:', solflare.publicKey.toString());
                    await logConnection(walletType, 'connected successfully');
                    await logWalletBalance(solflare.publicKey.toString());
                } catch (err) {
                    console.error('Connection failed:', err);
                }
            }
        } else {
            alert(`Please install ${walletType} wallet.`);
        }
        setShowModal(false);
    };

    const logConnection = async (walletType, status) => {
        try {
            await fetch('http://localhost:8080/log-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ walletType, status }),
            });
        } catch (error) {
            console.error('Error logging connection:', error);
        }
    };
    const getLatestBlockhash = async (connection) => {
        try {
            const { blockhash } = await connection.getLatestBlockhash();
            return blockhash;
        } catch (error) {
            console.error('Failed to fetch blockhash:', error);
            throw new Error('Failed to fetch blockhash');
        }
    };
    const handleMint = async () => {
        if (!wallet) {
            alert('Please connect a wallet first.');
            return;
        }
        try {
            console.log('Sending mint request with wallet:', wallet.toString());

            // Just send walletPublicKey.
            const response = await fetch('http://localhost:8080/mint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletPublicKey: wallet.toString() }), 
            });

            const data = await response.json();
            if (!response.ok) {
                console.error('Server response:', data);
                throw new Error(data.details || data.error || 'Failed to create transaction');
            }

            // Process the base64 string of the new transaction, sign, send, etc.
            // ...
        } catch (error) {
            console.error('Detailed mint error:', error);
            alert(`Minting failed: ${error.message}`);
        }
    };
    


    const formatTime = (seconds) => {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else {
            setIsButtonVisible(true);
        }
    }, [timeLeft]);

    // Example function to request Candy Machine creation from the server
    // Then sign & send with Phantom as the fee payer.
    const handleCreateCandyMachine = async () => {
        if (!wallet) {
          alert("Please connect a wallet first!");
          return;
        }
        // 1) Request partial transaction from the server
        const userPubkey = wallet.toString();
        const response = await fetch("http://localhost:8080/create-candy-machine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPubkey }),
        });
        const data = await response.json();
      
        // 2) Decode
        const transactionBytes = base64ToUint8Array(data.transaction);
        const versionedTx = VersionedTransaction.deserialize(transactionBytes);
        // const transaction = Transaction.from(transactionBytes);
      // Now call Phantom’s signAndSendTransaction:
const { signature } = await window.solana.signAndSendTransaction(versionedTx);
        // 3) Let Phantom set feePayer & sign as fee payer
        // const { signature } = await window.solana.signAndSendTransaction(transaction);
        console.log("Transaction signature =>", signature);
      };
    return (
        <div id="top-div">
            <video autoPlay muted loop id="background-video">
                <source src={video} type="video/mp4" />
            </video>
            <div className="main-sec">
                <header>
                    <div className='social-icons desktop-icons'>
                        <a href='#'><img src={img1} alt="icon" /></a>
                        <a href='#'><img src={img2} alt="icon" /></a>
                        <a href='#'><img src={img3} alt="icon" /></a>
                    </div>
                    <div className="logo">
                        <a href="/">
                            <img src={logo} alt="logo" />
                        </a>
                    </div>
                    <div className="header-right">
                        <div className="inner destop-inner">
                            <a href='#'><img src={img4} alt="icon" /> <span>OpenSea</span></a>
                            <a href='#'><img src={img5} alt="icon" /> <span>Rarible</span></a>
                        </div>
                    </div>
                    <nav ref={navRef}>
                        <div className="inner">
                            <a href='#' onClick={handleNavLinkClick}><img src={img4} alt="icon" /> <span>OpenSea</span></a>
                            <a href='#' onClick={handleNavLinkClick}><img src={img5} alt="icon" /> <span>Rarible</span></a>
                        </div>
                        <div className='social-icons mob-icons'>
                            <a href='#' onClick={handleNavLinkClick}><img src={img1} alt="icon" /></a>
                            <a href='#' onClick={handleNavLinkClick}><img src={img2} alt="icon" /></a>
                            <a href='#' onClick={handleNavLinkClick}><img src={img3} alt="icon" /></a>
                        </div>
                        <button className="nav-btn nav-close-btn" onClick={showNavbar}>
                            <FaTimes />
                        </button>
                    </nav>
                    <button className="nav-btn" onClick={showNavbar}>
                        <FaBars />
                    </button>
                    <button onClick={handleConnectWallet}>Connect Wallet</button>
                    <button onClick={handleMint}>Mint NFT</button>
                    <button onClick={handleCreateCandyMachine}>Create Candy Machine</button>
                </header>
                <div id="hero-text">
                    <div className="text">
                        <h1>A GREAT RECKONING APPROACHES</h1>
                        <p className="forge">Forge your own destiny in a vibrant, rich and open multiverse, spanning two universes and ten planets.</p>
                        {timeLeft > 0 ? (
                            <p><span className="count-text">Countdown to Mint</span><br /><br /><span className="time"> {formatTime(timeLeft)}</span></p>
                        ) : (
                            isButtonVisible && (
                                <button onClick={() => alert('Time is up!')}>
                                    Explore Now
                                </button>
                            )
                        )}
                    </div>
                </div>
                <img className="avt" src={avt} alt="avatar" />
            </div>
            {showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <h2>Select Wallet</h2>
                        <button onClick={() => handleWalletClick('Phantom')}>Phantom</button>
                        <button onClick={() => handleWalletClick('Solflare')}>Solflare</button>
                        <button onClick={() => setShowModal(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Header;