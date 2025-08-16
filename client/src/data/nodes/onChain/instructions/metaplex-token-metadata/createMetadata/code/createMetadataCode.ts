export const createMetadataCode = `
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, spl_token};
use anchor_spl::metadata::{
    create_metadata_accounts_v3,
    mpl_token_metadata::types::DataV2,
    CreateMetadataAccountsV3,
    Metadata,
};

#[derive(Accounts)]
pub struct CreateMetadataContext<'info> {
    /// CHECK: Metaplex metadata account (PDA) to be created
    #[account(mut)]
    pub metadata: AccountInfo<'info>,

    /// CHECK: Token mint account for which metadata is being created
    pub mint: AccountInfo<'info>,

    /// Mint authority (signer) - will be the update authority for metadata
    pub mint_authority: Signer<'info>,

    /// Payer for the metadata account creation (signer)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Metaplex Token Metadata program
    #[account(address = Metadata::id())]
    pub token_metadata_program: Program<'info, Metadata>,

    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateMetadataParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

pub fn create_metadata(
    ctx: Context<CreateMetadataContext>,
    params: CreateMetadataParams,
) -> Result<()> {
    // Verify the mint is a valid SPL token mint account
    if ctx.accounts.mint.owner != &spl_token::id() {
        return err!(CreateMetadataError::MintNotOwnedByTokenProgram);
    }
    // Derive the expected PDA for the metadata account and verify it matches the provided metadata pubkey
    let metadata_program_id = ctx.accounts.token_metadata_program.key();
    let mint_pubkey = ctx.accounts.mint.key();
    let (expected_metadata_pda, _bump) = Pubkey::find_program_address(
        &[b"metadata", metadata_program_id.as_ref(), mint_pubkey.as_ref()],
        &metadata_program_id
    );
    require!(
        ctx.accounts.metadata.key() == expected_metadata_pda,
        CreateMetadataError::InvalidMetadataAccount
    );

    // Prepare the metadata data (name, symbol, URI, no royalties or creators for fungible token)
    let metadata_data = DataV2 {
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };

    // Build the Metaplex create_metadata_accounts_v3 CPI context
    let cpi_accounts = CreateMetadataAccountsV3 {
        metadata: ctx.accounts.metadata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        mint_authority: ctx.accounts.mint_authority.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        update_authority: ctx.accounts.mint_authority.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_metadata_program.to_account_info(), cpi_accounts);

    // Invoke Metaplex Token Metadata program to create the metadata account
    create_metadata_accounts_v3(
        cpi_ctx,
        metadata_data,
        true,   // update_authority_is_signer (true since mint_authority is signing)
        true,   // is_mutable (allow future updates to metadata)
        None,   // optional collection details (not used here)
    )?;

    // Emit an event for the newly created metadata
    emit!(MetadataCreated {
        mint: ctx.accounts.mint.key(),
        metadata: ctx.accounts.metadata.key(),
    });
    Ok(())
}

#[event]
pub struct MetadataCreated {
    pub mint: Pubkey,
    pub metadata: Pubkey,
}

#[error_code]
pub enum CreateMetadataError {
    #[msg("Mint account is not owned by the Token Program.")]
    MintNotOwnedByTokenProgram,
    #[msg("The provided metadata account PDA is invalid for this mint.")]
    InvalidMetadataAccount,
}
`; 