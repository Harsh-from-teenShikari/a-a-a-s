// File: blockchain/src/challenge-program/challenge.ts
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import BN from 'bn.js';

// Program ID (would be deployed to Solana)
export const CHALLENGE_PROGRAM_ID = new PublicKey('ChAL1enGepr0graMiDxxxxxxxxxxxxxxxxxxxxx');

// Data layout for challenge account
export interface ChallengeData {
  isInitialized: boolean;
  challengeId: string;
  admin: PublicKey;
  stakingAmount: number;
  minParticipants: number;
  startDate: number;
  endDate: number;
  isComplete: boolean;
}

// Data layout for participant account
export interface ParticipantData {
  isInitialized: boolean;
  challengeAccount: PublicKey;
  user: PublicKey;
  hasCompleted: boolean;
  hasWithdrawn: boolean;
}

// Create a new challenge
export async function createChallenge(
  connection: Connection,
  payer: Keypair,
  challengeId: string,
  stakingAmount: number,
  minParticipants: number,
  startDate: number,
  endDate: number
): Promise<PublicKey> {
  // Create a new keypair for the challenge account
  const challengeAccount = Keypair.generate();
  
  // Calculate rent exemption amount
  const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(
    1024 // size in bytes
  );
  
  // Create transaction instruction to create account
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: challengeAccount.publicKey,
    lamports: rentExemptionAmount,
    space: 1024,
    programId: CHALLENGE_PROGRAM_ID,
  });
  
  // Create initialize challenge instruction
  const initChallengeInstruction = new TransactionInstruction({
    keys: [
      { pubkey: challengeAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    programId: CHALLENGE_PROGRAM_ID,
    data: Buffer.from(
      Uint8Array.of(
        0, // Initialize challenge instruction
        ...Buffer.from(challengeId),
        ...new BN(stakingAmount * LAMPORTS_PER_SOL).toArray('le', 8),
        ...new BN(minParticipants).toArray('le', 4),
        ...new BN(startDate).toArray('le', 8),
        ...new BN(endDate).toArray('le', 8)
      )
    ),
  });
  
  // Add instructions to transaction
  const transaction = new Transaction().add(
    createAccountInstruction,
    initChallengeInstruction
  );
  
  // Sign and send transaction
  await sendAndConfirmTransaction(connection, transaction, [payer, challengeAccount]);
  
  return challengeAccount.publicKey;
}

// Join a challenge by staking tokens
export async function joinChallenge(
  connection: Connection,
  payer: Keypair,
  challengeAccount: PublicKey,
  stakingAmount: number
): Promise<PublicKey> {
  // Create a new keypair for the participant account
  const participantAccount = Keypair.generate();
  
  // Calculate rent exemption amount
  const rentExemptionAmount = await connection.getMinimumBalanceForRentExemption(
    256 // size in bytes
  );
  
  // Create transaction instruction to create participant account
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: participantAccount.publicKey,
    lamports: rentExemptionAmount,
    space: 256,
    programId: CHALLENGE_PROGRAM_ID,
  });
  
  // Create join challenge instruction
  const joinChallengeInstruction = new TransactionInstruction({
    keys: [
      { pubkey: challengeAccount, isSigner: false, isWritable: true },
      { pubkey: participantAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    ],
    programId: CHALLENGE_PROGRAM_ID,
    data: Buffer.from(
      Uint8Array.of(
        1, // Join challenge instruction
        ...new BN(stakingAmount * LAMPORTS_PER_SOL).toArray('le', 8)
      )
    ),
  });
  
  // Transfer funds instruction
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: challengeAccount,
    lamports: stakingAmount * LAMPORTS_PER_SOL,
  });
  
  // Add instructions to transaction
  const transaction = new Transaction().add(
    createAccountInstruction,
    joinChallengeInstruction,
    transferInstruction
  );
  
  // Sign and send transaction
  await sendAndConfirmTransaction(connection, transaction, [payer, participantAccount]);
  
  return participantAccount.publicKey;
}

// Update participant completion status
export async function updateParticipantStatus(
  connection: Connection,
  admin: Keypair,
  participantAccount: PublicKey,
  hasCompleted: boolean
): Promise<string> {
  // Create update status instruction
  const updateStatusInstruction = new TransactionInstruction({
    keys: [
      { pubkey: participantAccount, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    ],
    programId: CHALLENGE_PROGRAM_ID,
    data: Buffer.from(
      Uint8Array.of(
        2, // Update status instruction
        hasCompleted ? 1 : 0
      )
    ),
  });
  
  // Create transaction
  const transaction = new Transaction().add(updateStatusInstruction);
  
  // Sign and send transaction
  return await sendAndConfirmTransaction(connection, transaction, [admin]);
}

// Complete challenge and distribute rewards
export async function completeChallenge(
  connection: Connection,
  admin: Keypair,
  challengeAccount: PublicKey
): Promise<string> {
  // Create complete challenge instruction
  const completeChallengeInstruction = new TransactionInstruction({
    keys: [
      { pubkey: challengeAccount, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    ],
    programId: CHALLENGE_PROGRAM_ID,
    data: Buffer.from(
      Uint8Array.of(
        3 // Complete challenge instruction
      )
    ),
  });
  
  // Create transaction
  const transaction = new Transaction().add(completeChallengeInstruction);
  
  // Sign and send transaction
  return await sendAndConfirmTransaction(connection, transaction, [admin]);
}

// Withdraw funds (for successful participants)
export async function withdrawFunds(
  connection: Connection,
  user: Keypair,
  participantAccount: PublicKey,
  challengeAccount: PublicKey
): Promise<string> {
  // Create withdraw funds instruction
  const withdrawFundsInstruction = new TransactionInstruction({
    keys: [
      { pubkey: challengeAccount, isSigner: false, isWritable: true },
      { pubkey: participantAccount, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
    ],
    programId: CHALLENGE_PROGRAM_ID,
    data: Buffer.from(
      Uint8Array.of(
        4 // Withdraw funds instruction
      )
    ),
  });
  
  // Create transaction
  const transaction = new Transaction().add(withdrawFundsInstruction);
  
  // Sign and send transaction
  return await sendAndConfirmTransaction(connection, transaction, [user]);
}

// Fetch challenge data
export async function getChallengeData(
  connection: Connection,
  challengeAccount: PublicKey
): Promise<ChallengeData | null> {
  try {
    const accountInfo = await connection.getAccountInfo(challengeAccount);
    
    if (!accountInfo) {
      return null;
    }
    
    // Parse account data
    const data = accountInfo.data;
    const isInitialized = data[0] === 1;
    
    if (!isInitialized) {
      return null;
    }
    
    // Extract challenge ID (bytes 1-33)
    const challengeId = data.slice(1, 33).toString();
    
    // Extract admin public key (bytes 33-65)
    const admin = new PublicKey(data.slice(33, 65));
    
    // Extract staking amount (bytes 65-73)
    const stakingAmountBN = new BN(data.slice(65, 73), 'le');
    const stakingAmount = stakingAmountBN.toNumber() / LAMPORTS_PER_SOL;
    
    // Extract min participants (bytes 73-77)
    const minParticipants = new BN(data.slice(73, 77), 'le').toNumber();
    
    // Extract dates (bytes 77-93)
    const startDate = new BN(data.slice(77, 85), 'le').toNumber();
    const endDate = new BN(data.slice(85, 93), 'le').toNumber();
    
    // Extract completion status (byte 93)
    const isComplete = data[93] === 1;
    
    return {
      isInitialized,
      challengeId,
      admin,
      stakingAmount,
      minParticipants,
      startDate,
      endDate,
      isComplete,
    };
  } catch (error) {
    console.error('Error fetching challenge data:', error);
    return null;
  }
}

// Fetch participant data
export async function getParticipantData(
  connection: Connection,
  participantAccount: PublicKey
): Promise<ParticipantData | null> {
  try {
    const accountInfo = await connection.getAccountInfo(participantAccount);
    
    if (!accountInfo) {
      return null;
    }
    
    // Parse account data
    const data = accountInfo.data;
    const isInitialized = data[0] === 1;
    
    if (!isInitialized) {
      return null;
    }
    
    // Extract challenge account public key (bytes 1-33)
    const challengeAccount = new PublicKey(data.slice(1, 33));
    
    // Extract user public key (bytes 33-65)
    const user = new PublicKey(data.slice(33, 65));
    
    // Extract completion status (byte 65)
    const hasCompleted = data[65] === 1;
    
    // Extract withdrawal status (byte 66)
    const hasWithdrawn = data[66] === 1;
    
    return {
      isInitialized,
      challengeAccount,
      user,
      hasCompleted,
      hasWithdrawn,
    };
  } catch (error) {
    console.error('Error fetching participant data:', error);
    return null;
  }
}
