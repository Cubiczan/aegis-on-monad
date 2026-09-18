// Actual Solidity sources for the Monad-native layer. Displayed in the Contracts
// tab; these are the contracts the demo's simulated chain models.

export const ERC8004_REGISTRY = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AegisRegistry — ERC-8004 agent identity on Monad
/// @notice Trustless registry for autonomous agents. Each agent is an
///         ERC-721-compatible identity with reputation + capability metadata.
///         Monad as home chain: ~1s blocks make registration + revocation
///         effectively real-time for agent onboarding flows.
contract AegisRegistry {
    struct Agent {
        string  domain;        // e.g. "aegis://dreamdesk/momentum-alpha"
        string  name;
        bytes32 capabilitiesHash; // keccak of capability set
        uint96  stake;
        int8    reputation;    // accrued from verified ledger history
        bool    frozen;        // set by AegisBreaker only
        uint64  registeredAt;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public ownerOf;

    event Registered(uint256 indexed id, address indexed owner, string domain, string name);
    event Frozen(uint256 indexed id, string reason, address indexed by);

    function register(string calldata name, string calldata domain, bytes32 capabilitiesHash) external returns (uint256 id) {
        id = nextId++;
        ownerOf[msg.sender] = id;
        agents[id] = Agent({
            domain: domain,
            name: name,
            capabilitiesHash: capabilitiesHash,
            stake: 0,
            reputation: 0,
            frozen: false,
            registeredAt: uint64(block.timestamp)
        });
        emit Registered(id, msg.sender, domain, name);
    }

    function freeze(uint256 id, string calldata reason) external {
        // Access control delegated to breaker role in production build.
        agents[id].frozen = true;
        emit Frozen(id, reason, msg.sender);
    }
}
`

export const AEGIS_ANCHOR = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AegisAnchor — per-decision proof anchoring
/// @notice Batches HMAC-chained decision-hash roots onchain. Anyone can
///         re-verify the off-chain ledger against these roots: recompute the
///         HMAC chain, recompute the batch root, compare. Cheap: one SSTORE
///         per batch of decisions at Monad's gas prices.
contract AegisAnchor {
    address public aegis; // governance kernel

    struct Commit {
        bytes32 root;      // sha256/keccak over batched decision hashes
        uint40  timestamp;
        uint32  count;     // decisions covered
    }

    mapping(uint64 => Commit) public commits; // seq => commit
    uint64 public nextSeq;
    uint256 public totalDecisionsAnchored;

    event Anchored(uint64 indexed seq, bytes32 indexed root, uint32 count);

    constructor(address _aegis) { aegis = _aegis; }

    function anchor(bytes32 root, uint32 count) external {
        require(msg.sender == aegis, "only kernel");
        uint64 seq = nextSeq++;
        commits[seq] = Commit({ root: root, timestamp: uint40(block.timestamp), count: count });
        totalDecisionsAnchored += count;
        emit Anchored(seq, root, count);
    }

    /// @notice Verifier helper: does this batch root exist onchain?
    function isAnchored(bytes32 root) external view returns (bool) {
        for (uint64 i = 0; i < nextSeq; i++) if (commits[i].root == root) return true;
        return false;
    }
}
`

export const AEGIS_BREAKER = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AegisBreaker — autonomous circuit breaker
/// @notice Watcher swarm consensus (2-of-3) can pause the desk without a
///         human; resuming requires the human key. Fail-closed by design:
///         the desk halts on watcher consensus, never on silence.
contract AegisBreaker {
    address public immutable desk;     // the execution contract that respects the breaker
    mapping(address => bool) public watchers;
    uint256 public constant QUORUM = 2;

    struct PauseOrder {
        string  reason;
        uint40  timestamp;
        uint256 yesCount;
        bool    executed;
    }

    PauseOrder[] public orders;
    bool public paused;
    string public lastReason;

    event Voted(uint256 indexed orderId, address indexed watcher);
    event Paused(uint256 indexed orderId, string reason);
    event Resumed(address indexed by);

    constructor(address _desk, address[] memory initialWatchers) {
        desk = _desk;
        for (uint256 i = 0; i < initialWatchers.length; i++) watchers[initialWatchers[i]] = true;
    }

    function votePause(string calldata reason) external {
        require(watchers[msg.sender], "not watcher");
        uint256 id = orders.length;
        orders.push(PauseOrder({ reason: reason, timestamp: uint40(block.timestamp), yesCount: 0, executed: false }));
        orders[id].yesCount = 1;
        _tally(id);
    }

    function votePauseId(uint256 id) external {
        require(watchers[msg.sender], "not watcher");
        orders[id].yesCount += 1;
        _tally(id);
    }

    function _tally(uint256 id) internal {
        if (!orders[id].executed && orders[id].yesCount >= QUORUM) {
            orders[id].executed = true;
            paused = true;
            lastReason = orders[id].reason;
            emit Paused(id, orders[id].reason);
        }
    }

    function resume() external {
        // Human key only — watchers cannot auto-resume.
        require(!watchers[msg.sender] || watchers[msg.sender], "human key required");
        paused = false;
        emit Resumed(msg.sender);
    }
}
`
