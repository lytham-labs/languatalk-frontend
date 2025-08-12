import { Memory } from '@/services/MemoriesService';

export class MemoriesHelper {
    /**
 * Get the FontAwesome icon for a memory category
 */
    static getCategoryIcon(category: string) {
        // Import FontAwesome icons dynamically to avoid circular dependencies
        const {
            faBullseyeArrow, faUsers, faPlane, faBriefcase,
            faHeart, faCalendarAlt, faTags, faCircle
        } = require('@fortawesome/pro-solid-svg-icons');

        switch (category.toLowerCase()) {
            case 'goals':
                return faBullseyeArrow;
            case 'family':
                return faUsers;
            case 'travel':
                return faPlane;
            case 'work':
                return faBriefcase;
            case 'interests':
                return faHeart;
            case 'future':
                return faCalendarAlt;
            case 'other':
                return faTags;
            default:
                return faCircle;
        }
    }

    /**
     * Get the color class for a memory category
     */
    static memoryCategoryColor(category: string): string {
        switch (category.toLowerCase()) {
            case 'goals':
                return 'success';
            case 'family':
                return 'info';
            case 'travel':
                return 'warning';
            case 'work':
                return 'primary';
            case 'interests':
                return 'danger';
            case 'future':
                return 'secondary';
            case 'other':
                return 'dark';
            default:
                return 'light';
        }
    }

    /**
     * Generate a summary string for memories
     */
    static memoriesSummary(memories: Memory[]): string {
        if (memories.length === 0) {
            return "No memories";
        }

        const total = memories.length;
        const categories = new Set(memories.map(memory => memory.category)).size;

        return `${total} ${total === 1 ? 'memory' : 'memories'} across ${categories} ${categories === 1 ? 'category' : 'categories'}`;
    }

    /**
     * Get emoji for memory category (compatible with existing getEmojiForCategory function)
     */
    static categoryEmoji(category: string): string {
        const emojiMap: { [key: string]: string } = {
            'food': '🍕',
            'travel': '🏛️',
            'learning': '🍝',
            'nature': '🌅',
            'work': '💼',
            'family': '👨‍👩‍👧‍👦',
            'hobby': '🎨',
            'health': '💪',
            'social': '👥',
            'achievement': '🏆',
            'goals': '🎯',
            'interests': '❤️',
            'future': '📅',
            'other': '🏷️',
            'default': '💭'
        };

        const categoryLower = category.toLowerCase();
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (categoryLower.includes(key)) {
                return emoji;
            }
        }
        return emojiMap.default;
    }

    /**
     * Get color value for memory category (for React Native styling)
     */
    static categoryColorValue(category: string): string {
        switch (category.toLowerCase()) {
            case 'goals':
                return '#10b981'; // success green
            case 'family':
                return '#3b82f6'; // info blue
            case 'travel':
                return '#f59e0b'; // warning amber
            case 'work':
                return '#8b5cf6'; // primary purple
            case 'interests':
                return '#ef4444'; // danger red
            case 'future':
                return '#6b7280'; // secondary gray
            case 'other':
                return '#374151'; // dark gray
            default:
                return '#9ca3af'; // light gray
        }
    }

    /**
     * Group memories by category
     */
    static groupMemoriesByCategory(memories: Memory[]): Record<string, Memory[]> {
        return memories.reduce((groups, memory) => {
            const category = memory.category;
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(memory);
            return groups;
        }, {} as Record<string, Memory[]>);
    }

    /**
     * Get category statistics
     */
    static getCategoryStats(memories: Memory[]): Array<{ category: string; count: number; label: string }> {
        const grouped = this.groupMemoriesByCategory(memories);
        return Object.entries(grouped).map(([category, categoryMemories]) => ({
            category,
            count: categoryMemories.length,
            label: categoryMemories[0]?.category_label || category
        })).sort((a, b) => b.count - a.count);
    }
}

export default MemoriesHelper; 
