export class HistoryManager {
    constructor(maxSize = 30) {
        this.maxSize = maxSize;
        this.undoStack = [];
        this.redoStack = [];
        this.currentState = null;
    }

    // Call this once on load to set the initial base state
    setInitialState(stateString) {
        this.currentState = stateString;
        this.undoStack = [];
        this.redoStack = [];
    }

    pushState(nextStateString) {
        if (!this.currentState) {
            this.currentState = nextStateString;
            return;
        }
        // Avoid duplicate states
        if (this.currentState === nextStateString) {
            return;
        }

        this.undoStack.push(this.currentState);
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
        this.currentState = nextStateString;
        this.redoStack = []; // Reset redo
    }

    undo() {
        if (!this.canUndo()) return null;
        
        const prevState = this.undoStack.pop();
        this.redoStack.push(this.currentState);
        this.currentState = prevState;
        
        return this.currentState;
    }

    redo() {
        if (!this.canRedo()) return null;
        
        const nextState = this.redoStack.pop();
        this.undoStack.push(this.currentState);
        this.currentState = nextState;
        
        return this.currentState;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }
}
