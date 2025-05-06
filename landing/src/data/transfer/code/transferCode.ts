export const transferCode =
`use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

#[derive(Accounts)]
pub struct TransferContext<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransferParams {
    pub amount: u64,
}

pub fn transfer(
    ctx: Context<TransferContext>,
    amount: u64
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.source.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts
        ),
        amount
    )?;

    Ok(())
}

#[event]
pub struct TransferCompleted {
    pub source: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum TransferError {
    #[msg("Insufficient funds in source account.")]
    InsufficientFunds,
    #[msg("Unauthorized transfer attempt.")]
    Unauthorized,
}
`;
