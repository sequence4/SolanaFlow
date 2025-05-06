export const mintToCode = `
use anchor_lang::prelude::*;
use anchor_spl::token::{self, spl_token, Token, MintToChecked};

#[derive(Accounts)]
pub struct MintToContext<'info> {
    #[account(mut, signer)]
    pub mint_authority: Signer<'info>,

    /// CHECK: existing mint account
    #[account(owner = spl_token::ID)]
    pub token_mint: AccountInfo<'info>,

    /// CHECK: destination token account (writable)
    #[account(mut, owner = spl_token::ID)]
    pub destination_token_account: AccountInfo<'info>,

    #[account(address = spl_token::ID)]
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MintToParams {
    pub amount: u64,
}

pub fn mint_to(
    ctx: Context<MintToContext>,
    params: MintToParams,
) -> Result<()> {
    let token_program = &ctx.accounts.token_program;
    let token_mint_info = &ctx.accounts.token_mint;
    let destination_account_info = &ctx.accounts.destination_token_account;
    let mint_authority = &ctx.accounts.mint_authority;

    // fetch decimals for checked minting
    let mint_state = spl_token::state::Mint::unpack(&token_mint_info.data.borrow())?;
    let decimals = mint_state.decimals;

    let cpi_ctx = CpiContext::new(
        token_program.to_account_info(),
        MintToChecked {
            mint: token_mint_info.clone(),
            to: destination_account_info.clone(),
            authority: mint_authority.to_account_info(),
        },
    );

    token::mint_to_checked(cpi_ctx, params.amount, decimals)?;

    emit!(MintToCompleted {
        mint: token_mint_info.key(),
        destination: destination_account_info.key(),
        amount: params.amount,
    });
    Ok(())
}

#[event]
pub struct MintToCompleted {
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum MintToError {
    #[msg("Mint account is not owned by the Token Program.")]
    MintNotOwnedByTokenProgram,
    #[msg("Destination account is not owned by the Token Program.")]
    DestinationNotOwnedByTokenProgram,
}
`;
