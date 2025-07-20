use crate::types::{RpcRequest, RpcResponse, RpcError};
use serde_json::Value;

/// Solana RPC method categories for routing optimization
#[derive(Debug, Clone, PartialEq)]
pub enum RpcMethodCategory {
    /// Real-time data that changes frequently
    Realtime,
    /// Account data that changes occasionally  
    Account,
    /// Transaction data
    Transaction,
    /// Block data
    Block,
    /// Static configuration data
    Static,
    /// Subscription methods
    Subscription,
}

/// Get the category for a Solana RPC method
pub fn get_method_category(method: &str) -> RpcMethodCategory {
    match method {
        // Real-time data
        "getSlot" | "getBlockHeight" | "getRecentBlockhash" | "getLatestBlockhash" 
        | "getEpochInfo" | "getHealth" | "getVersion" | "getInflationGovernor" 
        | "getInflationRate" | "getInflationReward" => RpcMethodCategory::Realtime,
        
        // Account data
        "getAccountInfo" | "getBalance" | "getTokenAccountBalance" | "getTokenSupply"
        | "getTokenAccountsByOwner" | "getTokenAccountsByDelegate" | "getProgramAccounts" 
        | "getMultipleAccounts" => RpcMethodCategory::Account,
        
        // Transaction data
        "getTransaction" | "getSignatureStatuses" | "getSignaturesForAddress"
        | "sendTransaction" | "simulateTransaction" | "getRecentPerformanceSamples"
        | "getTransactionCount" => RpcMethodCategory::Transaction,
        
        // Block data
        "getBlock" | "getBlockCommitment" | "getBlocks" | "getBlocksWithLimit"
        | "getFirstAvailableBlock" | "getBlockProduction" | "getBlockTime" => RpcMethodCategory::Block,
        
        // Static data
        "getGenesisHash" | "getIdentity" | "getClusterNodes" | "getVoteAccounts"
        | "getLeaderSchedule" | "getMinimumBalanceForRentExemption" | "getFeeForMessage"
        | "getFees" | "getRecentPrioritizationFees" => RpcMethodCategory::Static,
        
        // Subscriptions
        "accountSubscribe" | "accountUnsubscribe" | "programSubscribe" | "programUnsubscribe"
        | "signatureSubscribe" | "signatureUnsubscribe" | "slotSubscribe" | "slotUnsubscribe"
        | "rootSubscribe" | "rootUnsubscribe" | "logsSubscribe" | "logsUnsubscribe" => {
            RpcMethodCategory::Subscription
        }
        
        // Default to realtime for unknown methods
        _ => RpcMethodCategory::Realtime,
    }
}

/// Check if a method is cacheable
pub fn is_method_cacheable(method: &str) -> bool {
    matches!(get_method_category(method), 
        RpcMethodCategory::Static | RpcMethodCategory::Account | RpcMethodCategory::Block
    )
}

/// Get cache TTL in seconds for a method
pub fn get_cache_ttl(method: &str) -> Option<u64> {
    match get_method_category(method) {
        RpcMethodCategory::Static => Some(3600), // 1 hour
        RpcMethodCategory::Account => Some(10),  // 10 seconds
        RpcMethodCategory::Block => Some(60),    // 1 minute
        _ => None, // No caching for realtime/transaction/subscription methods
    }
}

/// Validate RPC request format
pub fn validate_rpc_request(request: &Value) -> Result<RpcRequest, String> {
    let jsonrpc = request.get("jsonrpc")
        .and_then(|v| v.as_str())
        .ok_or("Missing or invalid jsonrpc field")?;
    
    if jsonrpc != "2.0" {
        return Err("Invalid jsonrpc version, must be 2.0".to_string());
    }
    
    let method = request.get("method")
        .and_then(|v| v.as_str())
        .ok_or("Missing or invalid method field")?;
    
    if method.is_empty() {
        return Err("Method cannot be empty".to_string());
    }
    
    let id = request.get("id").cloned();
    let params = request.get("params").cloned();
    
    Ok(RpcRequest {
        id,
        method: method.to_string(),
        params,
        jsonrpc: jsonrpc.to_string(),
    })
}

/// Create an RPC error response
pub fn create_error_response(id: Option<Value>, code: i32, message: &str, data: Option<Value>) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message,
            "data": data
        }
    })
}

/// Create an RPC success response
pub fn create_success_response(id: Option<Value>, result: Value) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    })
}

/// Common RPC error codes
pub mod error_codes {
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;
    
    // Solana-specific error codes
    pub const BLOCK_NOT_AVAILABLE: i32 = -32004;
    pub const NODE_UNHEALTHY: i32 = -32005;
    pub const TRANSACTION_SIGNATURE_VERIFICATION_FAILURE: i32 = -32006;
    pub const BLOCK_CLEANED_UP: i32 = -32007;
    pub const SLOT_SKIPPED: i32 = -32008;
    pub const NO_SNAPSHOT: i32 = -32009;
    pub const LONG_TERM_STORAGE_SLOT_SKIPPED: i32 = -32010;
    pub const KEY_EXCLUDED_FROM_SECONDARY_INDEX: i32 = -32011;
    pub const TRANSACTION_HISTORY_NOT_AVAILABLE: i32 = -32012;
    pub const SCAN_ERROR: i32 = -32013;
    pub const TRANSACTION_SIGNATURE_LEN_MISMATCH: i32 = -32014;
    pub const BLOCK_STATUS_NOT_AVAILABLE_YET: i32 = -32015;
    pub const UNSUPPORTED_TRANSACTION_VERSION: i32 = -32016;
    pub const MIN_CONTEXT_SLOT_NOT_REACHED: i32 = -32017;
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_method_categorization() {
        assert_eq!(get_method_category("getSlot"), RpcMethodCategory::Realtime);
        assert_eq!(get_method_category("getAccountInfo"), RpcMethodCategory::Account);
        assert_eq!(get_method_category("getTransaction"), RpcMethodCategory::Transaction);
        assert_eq!(get_method_category("getBlock"), RpcMethodCategory::Block);
        assert_eq!(get_method_category("getGenesisHash"), RpcMethodCategory::Static);
        assert_eq!(get_method_category("accountSubscribe"), RpcMethodCategory::Subscription);
    }
    
    #[test]
    fn test_cache_settings() {
        assert!(is_method_cacheable("getGenesisHash"));
        assert!(is_method_cacheable("getAccountInfo"));
        assert!(!is_method_cacheable("getSlot"));
        
        assert_eq!(get_cache_ttl("getGenesisHash"), Some(3600));
        assert_eq!(get_cache_ttl("getAccountInfo"), Some(10));
        assert_eq!(get_cache_ttl("getSlot"), None);
    }
    
    #[test]
    fn test_validate_rpc_request() {
        let valid_request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSlot"
        });
        
        let request = validate_rpc_request(&valid_request).unwrap();
        assert_eq!(request.method, "getSlot");
        assert_eq!(request.jsonrpc, "2.0");
        
        let invalid_request = json!({
            "jsonrpc": "1.0",
            "id": 1,
            "method": "getSlot"
        });
        
        assert!(validate_rpc_request(&invalid_request).is_err());
    }
}