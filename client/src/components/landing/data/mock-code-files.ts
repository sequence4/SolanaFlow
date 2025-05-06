export const codeFiles = [
    // Initialize Mint
    `use anchor_lang::prelude::*;
use anchor_spl::token::{self, spl_token, InitializeMint, Token};

#[derive(Accounts)]
pub struct InitializeMintContext<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut)]
    pub token_mint: AccountInfo<'info>,
    
    #[account(address = spl_token::id())]
    pub token_program: Program<'info, Token>,
    
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeMintParams {
    pub decimals: u8,
    pub mint_authority: Pubkey,
}`,

    // Initialize Mint Implementation
    `pub fn initialize_mint(
      ctx: Context<InitializeMintContext>,
      params: InitializeMintParams,
    ) -> Result<()> {
      let payer = &ctx.accounts.payer;
      let token_mint_info = &ctx.accounts.token_mint;
      let token_program = &ctx.accounts.token_program;
      let rent = &ctx.accounts.rent;

      let mint_len = spl_token::state::Mint::LEN;
      let lamports = rent.minimum_balance(mint_len);
      
      let cpi_ctx = CpiContext::new(
          token_program.to_account_info(),
          InitializeMint {
              mint: token_mint_info.clone(),
              rent: rent.to_account_info(),
          },
      );

      token::initialize_mint(cpi_ctx, params.decimals, 
                            &params.mint_authority, None)?;

      emit!(MintInitialized {
          mint_authority: params.mint_authority,
          amount: 0,
      });

      Ok(())
    }`,

    // MintTo Context
    `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, MintTo};

#[derive(Accounts)]
pub struct MintToContext<'info> {
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    
    #[account(mut)]
    pub token_mint: AccountInfo<'info>,
    
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MintToParams {
    pub amount: u64,
}`,

    // MintTo Implementation
    `pub fn mint_to(
      ctx: Context<MintToContext>,
      params: MintToParams,
    ) -> Result<()> {
      let token_program = &ctx.accounts.token_program;
      let token_mint = &ctx.accounts.token_mint;
      let destination = &ctx.accounts.destination;
      let authority = &ctx.accounts.mint_authority;

      if token_mint.owner != &spl_token::id() {
          return err!(MintToError::MintNotOwnedByTokenProgram);
      }

      let cpi_ctx = CpiContext::new(
          token_program.to_account_info(),
          MintTo {
              mint: token_mint.clone(),
              to: destination.clone(),
              authority: authority.to_account_info(),
          },
      );

      token::mint_to(cpi_ctx, params.amount)?;

      emit!(TokensMinted {
          mint_authority: authority.key(),
          amount: params.amount,
      });

      Ok(())
    }`,

    // Transfer Context
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
}`,

    // Transfer Implementation
    `pub fn transfer_tokens(
      ctx: Context<TransferContext>,
      params: TransferParams,
    ) -> Result<()> {
      let authority = &ctx.accounts.authority;
      let source = &ctx.accounts.source;
      let destination = &ctx.accounts.destination;
      let token_program = &ctx.accounts.token_program;

      let cpi_ctx = CpiContext::new(
          token_program.to_account_info(),
          Transfer {
              from: source.to_account_info(),
              to: destination.to_account_info(),
              authority: authority.to_account_info(),
          },
      );

      token::transfer(cpi_ctx, params.amount)?;

      emit!(TransferCompleted {
          source: source.key(),
          destination: destination.key(),
          amount: params.amount,
      });

      Ok(())
    }`
  ];