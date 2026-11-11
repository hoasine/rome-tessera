// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Tessera
/// @notice Non-transferable event check-in badges that EVM and Solana wallets claim on Rome.
/// @dev An organizer registers a throwaway event key (`signer`). The QR code at the venue
///      carries that key, which signs the attendee's own address, so a claim cannot be
///      replayed for another wallet. Solana claims are proven because Rome derives a Solana
///      wallet's EVM caller as the last 20 bytes of keccak256(pubkey).
contract Tessera {
    uint64 public constant MAX_DURATION = 30 days;
    uint256 public constant MAX_PAGE_SIZE = 25;
    uint256 private constant HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    struct EventInfo {
        address organizer;
        address signer;
        string name;
        string description;
        string location;
        uint64 createdAt;
        uint64 startsAt;
        uint64 endsAt;
        uint32 maxClaims;
        uint32 evmClaims;
        uint32 solanaClaims;
        bool closed;
    }

    struct EventView {
        uint256 id;
        address organizer;
        address signer;
        string name;
        string description;
        string location;
        uint64 createdAt;
        uint64 startsAt;
        uint64 endsAt;
        uint32 maxClaims;
        uint32 evmClaims;
        uint32 solanaClaims;
        bool closed;
    }

    struct Badge {
        uint256 eventId;
        uint64 claimedAt;
        bool solana;
    }

    error AlreadyClaimed();
    error EmptyValue();
    error EventClosed();
    error EventFull();
    error EventNotFound();
    error EventNotStarted();
    error InvalidAddress();
    error InvalidSignature();
    error InvalidWindow();
    error LimitTooLarge();
    error NotOrganizer();
    error NotSolanaSigner();
    error TextTooLong();

    uint256 public eventCount;

    mapping(uint256 => EventInfo) private _events;
    mapping(uint256 => mapping(address => uint64)) private _claimedAt;
    mapping(address => Badge[]) private _badges;

    event EventCreated(uint256 indexed eventId, address indexed organizer, address signer);
    event SignerRotated(uint256 indexed eventId, address signer);
    event EventClosedEarly(uint256 indexed eventId);
    event BadgeClaimed(
        uint256 indexed eventId,
        address indexed attendee,
        bool solana,
        bytes32 solanaPubkey
    );

    function createEvent(
        string calldata name,
        string calldata description,
        string calldata location,
        uint64 startsAt,
        uint64 endsAt,
        uint32 maxClaims,
        address signer
    ) external returns (uint256 eventId) {
        _requireText(name, 80);
        if (bytes(description).length > 500 || bytes(location).length > 120) {
            revert TextTooLong();
        }
        if (signer == address(0)) revert InvalidAddress();
        if (
            endsAt <= startsAt ||
            endsAt <= block.timestamp ||
            endsAt - startsAt > MAX_DURATION
        ) revert InvalidWindow();

        eventId = ++eventCount;
        EventInfo storage info = _events[eventId];
        info.organizer = msg.sender;
        info.signer = signer;
        info.name = name;
        info.description = description;
        info.location = location;
        info.createdAt = uint64(block.timestamp);
        info.startsAt = startsAt;
        info.endsAt = endsAt;
        info.maxClaims = maxClaims;
        emit EventCreated(eventId, msg.sender, signer);
    }

    function claim(uint256 eventId, bytes calldata signature) external {
        _claim(eventId, signature, false, bytes32(0));
    }

    function claimAsSolana(
        uint256 eventId,
        bytes calldata signature,
        bytes32 solanaPubkey
    ) external {
        if (syntheticAddressOf(solanaPubkey) != msg.sender) revert NotSolanaSigner();
        _claim(eventId, signature, true, solanaPubkey);
    }

    function rotateSigner(uint256 eventId, address newSigner) external {
        EventInfo storage info = _requireOrganizer(eventId);
        if (newSigner == address(0)) revert InvalidAddress();
        info.signer = newSigner;
        emit SignerRotated(eventId, newSigner);
    }

    function closeEvent(uint256 eventId) external {
        EventInfo storage info = _requireOrganizer(eventId);
        if (info.closed) revert EventClosed();
        info.closed = true;
        emit EventClosedEarly(eventId);
    }

    /// @notice The 32-byte message the event key signs, as an EIP-191 personal message.
    function claimDigest(uint256 eventId, address attendee) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), eventId, attendee));
    }

    function syntheticAddressOf(bytes32 solanaPubkey) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(solanaPubkey)))));
    }

    function getEvent(uint256 eventId) public view returns (EventView memory) {
        EventInfo storage info = _getEvent(eventId);
        return EventView({
            id: eventId,
            organizer: info.organizer,
            signer: info.signer,
            name: info.name,
            description: info.description,
            location: info.location,
            createdAt: info.createdAt,
            startsAt: info.startsAt,
            endsAt: info.endsAt,
            maxClaims: info.maxClaims,
            evmClaims: info.evmClaims,
            solanaClaims: info.solanaClaims,
            closed: info.closed
        });
    }

    /// @notice Returns events newest first.
    function getEvents(uint256 offset, uint256 limit) external view returns (EventView[] memory page) {
        if (limit > MAX_PAGE_SIZE) revert LimitTooLarge();
        if (offset >= eventCount || limit == 0) return new EventView[](0);
        uint256 size = eventCount - offset;
        if (size > limit) size = limit;
        page = new EventView[](size);
        for (uint256 index; index < size; index++) {
            page[index] = getEvent(eventCount - offset - index);
        }
    }

    function claimedAt(uint256 eventId, address attendee) external view returns (uint64) {
        _getEvent(eventId);
        return _claimedAt[eventId][attendee];
    }

    function badgeCount(address attendee) external view returns (uint256) {
        return _badges[attendee].length;
    }

    /// @notice Returns an attendee's badges newest first.
    function badgesOf(
        address attendee,
        uint256 offset,
        uint256 limit
    ) external view returns (Badge[] memory page) {
        if (limit > MAX_PAGE_SIZE) revert LimitTooLarge();
        Badge[] storage all = _badges[attendee];
        if (offset >= all.length || limit == 0) return new Badge[](0);
        uint256 size = all.length - offset;
        if (size > limit) size = limit;
        page = new Badge[](size);
        for (uint256 index; index < size; index++) {
            page[index] = all[all.length - 1 - offset - index];
        }
    }

    function _claim(
        uint256 eventId,
        bytes calldata signature,
        bool solana,
        bytes32 solanaPubkey
    ) private {
        EventInfo storage info = _getEvent(eventId);
        if (info.closed || block.timestamp >= info.endsAt) revert EventClosed();
        if (block.timestamp < info.startsAt) revert EventNotStarted();
        if (_claimedAt[eventId][msg.sender] != 0) revert AlreadyClaimed();
        uint256 claimed = uint256(info.evmClaims) + info.solanaClaims;
        if (info.maxClaims != 0 && claimed >= info.maxClaims) revert EventFull();
        if (_recover(claimDigest(eventId, msg.sender), signature) != info.signer) {
            revert InvalidSignature();
        }

        _claimedAt[eventId][msg.sender] = uint64(block.timestamp);
        _badges[msg.sender].push(Badge(eventId, uint64(block.timestamp), solana));
        if (solana) info.solanaClaims++;
        else info.evmClaims++;
        emit BadgeClaimed(eventId, msg.sender, solana, solanaPubkey);
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (v < 27) v += 27;
        if ((v != 27 && v != 28) || uint256(s) > HALF_ORDER) revert InvalidSignature();
        bytes32 message = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address signer = ecrecover(message, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    function _requireOrganizer(uint256 eventId) private view returns (EventInfo storage info) {
        info = _getEvent(eventId);
        if (info.organizer != msg.sender) revert NotOrganizer();
    }

    function _getEvent(uint256 eventId) private view returns (EventInfo storage info) {
        info = _events[eventId];
        if (info.organizer == address(0)) revert EventNotFound();
    }

    function _requireText(string calldata value, uint256 maxBytes) private pure {
        if (bytes(value).length == 0) revert EmptyValue();
        if (bytes(value).length > maxBytes) revert TextTooLong();
    }
}
