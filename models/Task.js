const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Title is a required field and cannot be empty."]
    },
    description: {
        type: String,
        default: ""
    },
    completed: {
        type: Boolean,
        default: false
    },
    priority: {
        type: String,
        enum: {
            values: ['low', 'medium', 'high'],
            message: "Priority must be either 'low', 'medium', or 'high'."
        },
        default: 'medium'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

// Pre-save hook to automatically trim whitespace from the title field
taskSchema.pre('save', function() {
    if (this.title) {
        this.title = this.title.trim();
    }
});

module.exports = mongoose.model('Task', taskSchema);
