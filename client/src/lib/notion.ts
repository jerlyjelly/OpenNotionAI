// Class to handle interactions with Notion API
export interface DatabaseProperty {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: { name: string; color: string; id: string }[];
}

export interface DatabaseStructure {
  title: string;
  properties: DatabaseProperty[];
}

export class NotionClient {
  private apiKey: string;
  private databaseId: string;
  private apiVersion = "2022-06-28";
  private baseUrl = "https://api.notion.com/v1";

  constructor(apiKey: string, databaseId: string) {
    this.apiKey = apiKey;
    this.databaseId = databaseId;
  }

  private async fetchWithNotionAuth(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(`/api/notion?url=${encodeURIComponent(url)}`, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        "Notion-Auth": this.apiKey,
        "Notion-Version": this.apiVersion,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Notion API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getDatabaseStructure(): Promise<DatabaseStructure> {
    const data = await this.fetchWithNotionAuth(`/databases/${this.databaseId}`);
    
    const properties = Object.entries(data.properties).map(([_, value]: [string, any]) => ({
      id: value.id,
      name: value.name,
      type: value.type,
      description: value.description,
      options: value.type === 'select' || value.type === 'multi_select' 
        ? value[value.type].options 
        : undefined
    }));

    return {
      title: data.title[0]?.plain_text || "Untitled Database",
      properties: properties as DatabaseProperty[]
    };
  }

  async queryDatabase(filter?: any, sorts?: any[]): Promise<any[]> {
    const data = await this.fetchWithNotionAuth(`/databases/${this.databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter,
        sorts
      })
    });
    
    return data.results;
  }

  async getPage(pageId: string): Promise<any> {
    return this.fetchWithNotionAuth(`/pages/${pageId}`);
  }

  async createPage(properties: Record<string, any>, children?: any[]): Promise<any> {
    return this.fetchWithNotionAuth('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: this.databaseId },
        properties,
        children
      })
    });
  }

  async updatePage(pageId: string, properties: Record<string, any>): Promise<any> {
    return this.fetchWithNotionAuth(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }
}
