- Simplifying the Logic Flow: 

The biggest problem is with the burning mechanism. As currently implemented in ERC20, this is unlikely to work in practice on solana because:

Token accounts in Solana belong to their owners, and by default, only the owner can authorize a burn
The recipient would need to have explicitly delegated burn authority to the token_config PDA

In the special case (external whitelisted sender → internal whitelisted recipient), we simply burn the tokens from the sender's account instead of trying to transfer and then burn from the recipient.