// ========================================================================
// FILE: traits/ReentrancyGuard.tact
// ========================================================================
// Trait for anti-reentrancy protection
trait ReentrancyGuard {
    locked: Bool;

    fun requireNotLocked() {
        require(!self.locked, "Reentrant");
    }

    fun lock() {
        self.locked = true;
    }

    fun unlock() {
        self.locked = false;
    }
}