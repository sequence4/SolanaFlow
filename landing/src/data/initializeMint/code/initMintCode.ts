export const initMintCode = `
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;
use anchor_spl::token::{self, spl_token, Token, InitializeMint};

#[derive(Accounts)]
pub struct InitializeMintContext<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: new mint account signed by the client creating it
    #[account(mut, signer)]
    pub token_mint: AccountInfo<'info>,

    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,

    #[account(address = spl_token::ID)]
    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeMintParams {
    pub decimals: u8,
    pub mint_authority: Pubkey,
}

pub fn initialize_mint(
    ctx: Context<InitializeMintContext>,
    params: InitializeMintParams,
) -> Result<()> {
    let payer = &ctx.accounts.payer;
    let token_mint_info = &ctx.accounts.token_mint;
    let system_program = &ctx.accounts.system_program;
    let token_program = &ctx.accounts.token_program;
    let rent = &ctx.accounts.rent;

    let decimals = params.decimals;
    require!(decimals <= 9, InitializeMintError::InvalidDecimalsValue);

    let mint_authority = params.mint_authority;

    // create the mint account; the client signs for \`token_mint\` so no PDA seeds are needed
    let mint_len = spl_token::state::Mint::LEN;
    let lamports = rent.minimum_balance(mint_len);
    let create_ix = system_instruction::create_account(
        &payer.key(),
        &token_mint_info.key(),
        lamports,
        mint_len as u64,
        &spl_token::id(),
    );
    anchor_lang::solana_program::program::invoke(
        &create_ix,
        &[payer.to_account_info(), token_mint_info.clone(), system_program.to_account_info()],
    )?;

    // initialise mint via CPI
    let cpi_ctx = CpiContext::new(
        token_program.to_account_info(),
        InitializeMint {
            mint: token_mint_info.clone(),
            rent: rent.to_account_info(),
        },
    );
    token::initialize_mint(cpi_ctx, decimals, &mint_authority, None)?;

    emit!(MintInitialized {
        mint: token_mint_info.key(),
        decimals,
    });
    Ok(())
}

#[event]
pub struct MintInitialized {
    pub mint: Pubkey,
    pub decimals: u8,
}

#[error_code]
pub enum InitializeMintError {
    #[msg("Mint account is not owned by the Token Program.")]
    MintNotOwnedByTokenProgram,
    #[msg("Destination account is not owned by the Token Program.")]
    DestinationNotOwnedByTokenProgram,
    #[msg("Decimals value must be between 0 and 9")]
    InvalidDecimalsValue,
}
`;