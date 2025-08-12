import { API_URL } from '@/constants/api';

export interface Memory {
    id: number;
    content: string;
    category: string;
    category_label: string;
    date: string;
    created_at: string;
    updated_at: string;
}

export interface Category {
    key: string;
    label: string;
    count: number;
}

export interface MemoriesResponse {
    memories: Memory[];
    grouped_memories: Record<string, Memory[]>;
    total_count: number;
    categories: string[];
}

export interface CategoriesResponse {
    categories: Category[];
}

export interface ProcessingStatusResponse {
    processing: boolean;
    timestamp: string;
    user_id: number;
    current_memories?: number;
    status?: string;
    lock_expires_at?: number;
    final_memories?: number;
    recent_memories?: number;
    old_memories?: number;
    new_memories_since_processing?: number;
}

export interface ExtractResponse {
    message: string;
    status: string;
}

export interface DeleteAllResponse {
    success: boolean;
    message: string;
    deleted_count: number;
}

class MemoriesService {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
        };
    }

    async fetchMemories(): Promise<MemoriesResponse> {
        const response = await fetch(`${API_URL}/api/v1/memories`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch memories');
        }

        return response.json();
    }

    async fetchCategories(): Promise<CategoriesResponse> {
        const response = await fetch(`${API_URL}/api/v1/memories/categories`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch categories');
        }

        return response.json();
    }

    async extractMemories(): Promise<ExtractResponse> {
        const response = await fetch(`${API_URL}/api/v1/memories/extract`, {
            method: 'POST',
            headers: this.getHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to extract memories');
        }

        return data;
    }

    async checkProcessingStatus(): Promise<ProcessingStatusResponse> {
        const response = await fetch(`${API_URL}/api/v1/memories/check_processing`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to check processing status');
        }

        return response.json();
    }

    async deleteAllMemories(): Promise<DeleteAllResponse> {
        const response = await fetch(`${API_URL}/api/v1/memories/delete_all`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete memories');
        }

        return data;
    }

    async deleteMemory(memoryId: number): Promise<{ message: string }> {
        const response = await fetch(`${API_URL}/api/v1/memories/${memoryId}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete memory');
        }

        return data;
    }

    async createMemory(memoryData: { content: string; category: string; date?: string }): Promise<{ memory: Memory; message: string }> {
        const response = await fetch(`${API_URL}/api/v1/memories`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ memory: memoryData }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create memory');
        }

        return data;
    }

    async updateMemory(memoryId: number, updates: Partial<Memory>): Promise<{ memory: Memory; message: string }> {
        const response = await fetch(`${API_URL}/api/v1/memories/${memoryId}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ memory: updates }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update memory');
        }

        return data;
    }

    async getMemoriesByCategory(category: string): Promise<{
        category: string;
        category_label: string;
        memories: Memory[];
        count: number;
    }> {
        const response = await fetch(`${API_URL}/api/v1/memories/by_category/${category}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch memories by category');
        }

        return response.json();
    }
}

export default MemoriesService; 
