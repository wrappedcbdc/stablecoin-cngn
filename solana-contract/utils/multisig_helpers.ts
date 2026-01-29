
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import nacl from "tweetnacl";


  // Helper function to create Ed25519 signature instruction
  export function createEd25519Ix(
    signer: Keypair,
    message: Buffer
  ): TransactionInstruction {
    const signature = nacl.sign.detached(message, signer.secretKey);
    const publicKey = signer.publicKey.toBytes();

    const numSignatures = 1;
    const padding = 0;

    const offsetsStruct = Buffer.alloc(14);
    offsetsStruct.writeUInt16LE(16, 0);  // signature_offset
    offsetsStruct.writeUInt16LE(0xFFFF, 2);  // signature_instruction_index
    offsetsStruct.writeUInt16LE(80, 4);  // public_key_offset
    offsetsStruct.writeUInt16LE(0xFFFF, 6);  // public_key_instruction_index
    offsetsStruct.writeUInt16LE(112, 8);  // message_data_offset
    offsetsStruct.writeUInt16LE(message.length, 10);  // message_data_size
    offsetsStruct.writeUInt16LE(0xFFFF, 12);  // message_instruction_index

    const data = Buffer.concat([
      Buffer.from([numSignatures, padding]),
      offsetsStruct,
      Buffer.from(signature),
      publicKey,
      message
    ]);

    return new TransactionInstruction({
      keys: [],
      programId: new PublicKey('Ed25519SigVerify111111111111111111111111111'),
      data,
    });
  }

