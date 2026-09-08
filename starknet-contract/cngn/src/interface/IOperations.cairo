use starknet::ContractAddress;

#[starknet::interface]
pub trait IAdmin<TContractState> {
    fn can_forward(self: @TContractState, user: ContractAddress) -> bool;
    fn can_mint(self: @TContractState, user: ContractAddress) -> bool;
    fn mint_amount(self: @TContractState, user: ContractAddress) -> u256;
    fn is_black_listed(self: @TContractState, user: ContractAddress) -> bool;
    fn trusted_contract(self: @TContractState, contract_address: ContractAddress) -> bool;
    fn is_external_sender_whitelisted(self: @TContractState, user: ContractAddress) -> bool;
    fn is_internal_user_whitelisted(self: @TContractState, user: ContractAddress) -> bool;

    fn add_can_mint(ref self: TContractState, user: ContractAddress) -> bool;
    fn remove_can_mint(ref self: TContractState, user: ContractAddress) -> bool;
    fn add_mint_amount(ref self: TContractState, user: ContractAddress, amount: u256) -> bool;
    fn remove_mint_amount(ref self: TContractState, user: ContractAddress) -> bool;
    fn whitelist_internal_user(ref self: TContractState, user: ContractAddress) -> bool;
    fn blacklist_internal_user(ref self: TContractState, user: ContractAddress) -> bool;
    fn whitelist_external_sender(ref self: TContractState, user: ContractAddress) -> bool;
    fn blacklist_external_sender(ref self: TContractState, user: ContractAddress) -> bool;
    fn add_can_forward(ref self: TContractState, user: ContractAddress) -> bool;
    fn remove_can_forward(ref self: TContractState, user: ContractAddress) -> bool;
    fn add_trusted_contract(ref self: TContractState, contract_address: ContractAddress) -> bool;
    fn remove_trusted_contract(ref self: TContractState, contract_address: ContractAddress) -> bool;
    fn add_black_list(ref self: TContractState, evil_user: ContractAddress) -> bool;
    fn remove_black_list(ref self: TContractState, cleared_user: ContractAddress) -> bool;
}

