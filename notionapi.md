Notion API: Working with Pages, Databases, Comments, and Files for LLM DevelopmentThis document provides a comprehensive guide to interacting with core Notion objects using the official API, specifically tailored for developers building applications, particularly those leveraging Large Language Models (LLMs). It synthesizes information regarding page content, databases, comments, and file handling, focusing on the structures, endpoints, capabilities, and limitations relevant to programmatic interaction.1. Working with Page ContentNotion pages serve as versatile canvases for various types of content. Understanding how this content is structured and manipulated via the API is fundamental for integrations that read from or write to Notion pages.11.1. Page Content vs. PropertiesA key distinction exists between page content and page properties. Page properties are designed for structured metadata associated with a page, such as due dates, status categories, or relations to other pages (often used within databases). Page content, conversely, accommodates free-form text, headings, images, lists, and other elements that constitute the main body of the page. Integrations should respect this distinction, using properties for structured data and the content area for narrative or less structured information, aligning with user expectations.11.2. Modeling Content as BlocksPage content is represented in the API as a list of(https://developers.notion.com/reference/block). These blocks are considered the children of the page. Each block possesses a type (e.g., paragraph, heading_1, image, to_do) and common metadata like id, created_time, last_edited_time, and has_children.1A simple paragraph block illustrates the basic structure:JSON{
  "object": "block",
  "id": "380c78c0-e0f5-4565-bdbd-c4ccb079050d",
  "type": "paragraph",
  "created_time": "...",
  "last_edited_time": "...",
  "has_children": false,
  "paragraph": {
    "rich_text": [/* array of rich text objects */]
  }
}
Blocks contain type-specific data nested under a key matching the type value. For instance, the paragraph block contains its configuration within a paragraph object, primarily holding the rich_text array that forms its content.1Some block types, like paragraph or toggle, can contain nested child blocks. When a block has children, its has_children property is true, and the children are represented as an array of block objects within the type-specific configuration.1JSON{
  "object": "block",
  "id": "380c78c0-e0f5-4565-bdbd-c4ccb079050d",
  "type": "paragraph",
  //... other common properties...
  "has_children": true,
  "paragraph": {
    "rich_text": [/* details omitted */],
    "children": [
      {
        "object": "block",
        "id": "6d5b2463-a1c1-4e22-9b3b-49b3fe7ad384",
        "type": "to_do",
        //... other common properties...
        "has_children": false,
        "to_do": {
          "rich_text": [/* details omitted */],
          "checked": false
        }
      }
      //... potentially more child blocks...
    ]
  }
}
It is important to note that Pages themselves are a special type of block and can have children. When retrieving block children, a Page ID can be used as the block_id.1 Furthermore, when a page appears nested within another page in the Notion UI, it is represented as a child_page block type in the API. This child_page block acts as a reference and does not contain the child page's actual content or children within its own structure.1The API supports a subset of Notion's available block types. If an unsupported block type is encountered (e.g., when reading a page created via the UI), it will be represented with the type unsupported.1 Integrations should handle this type gracefully, perhaps by ignoring it or notifying the user.1.3. Rich Text ObjectsTextual content within blocks (and also in page properties) is represented not as simple strings, but as arrays of(https://developers.notion.com/reference/rich-text). This structure allows for inline formatting, mentions, links, and equations.1Each rich text object has a type (e.g., text, mention, equation) and contains type-specific data, annotations (styling like bold, italic, color), the plain_text representation, and an optional href for links.1A simple example for the text "Grocery List":JSON{
  "type": "text",
  "text": {
    "content": "Grocery List",
    "link": null
  },
  "annotations": {
    "bold": false,
    "italic": false,
    "strikethrough": false,
    "underline": false,
    "code": false,
    "color": "default"
  },
  "plain_text": "Grocery List",
  "href": null
}
Processing or generating content requires working with these rich text arrays, constructing them correctly when writing, and parsing them appropriately when reading.11.4. Creating a Page with ContentNew pages can be created using the(https://developers.notion.com/reference/post-page). This endpoint allows creating pages either as children of other pages or as entries within a database.1The request requires three main parameters: parent, properties, and optionally children.
parent: Specifies where the page should be created.

For a child of another page, use a page parent object: { "type": "page_id", "page_id": "<parent_page_id>" }.1
For a page within a database, use a database parent object: { "type": "database_id", "database_id": "<parent_database_id>" }.2


properties: Defines the page's properties.

For non-database pages, only the title property is required and typically settable.2 Example:
JSON{
  "Name": { // Or often just "title" depending on context
    "type": "title",
    "title": [{ "type": "text", "text": { "content": "A note from your pals at Notion" } }]
  }
}


For pages within a database, the properties must conform to the database's schema.1 (See Section 2.3 for details).


children: An optional array of block objects representing the initial content of the page.1 Example:
JSON[
  {
    "object": "block",
    "type": "paragraph",
    "paragraph": {
      "rich_text": [{ "type": "text", "text": { "content": "You made this page using the Notion API..." } }]
    }
  }
]


Before creating a page, several preconditions must be met. The integration must have the necessary permissions to access the specified parent page or database. Users grant these permissions via the Notion UI's sharing menu (Add connections).1 The correct page_id or database_id for the parent must also be obtained. While manual methods exist (copying links and parsing URLs), the recommended approach for integrations is often to use the(https://developers.notion.com/reference/post-search) to allow users to find and select the desired parent.1 If creating a page within a database, the integration must also know the database's schema to construct the properties object correctly (see Section 2.2). Therefore, creating a page is often not an isolated API call but part of a workflow involving ID retrieval, permission checks (or user guidance), and potentially schema fetching.Developers must also be aware of API size limits when creating pages with content. Attempting to create a very large page with extensive initial content in a single API call might fail.1 A more robust strategy for large documents could involve creating the page with minimal content (or just properties) and then using the Append block children endpoint (see Section 1.6) in batches to add the remaining content, respecting API rate limits.Full curl and JavaScript (@notionhq/client) examples for creating a page are available in the documentation.1 A successful request returns the newly created Page object.11.5. Reading Blocks from a PageTo retrieve the content (child blocks) of an existing page or block, use the(https://developers.notion.com/reference/get-block-children).1 The ID of the parent block (which can be a page ID) is provided in the path.1The endpoint returns a paginated list of block objects.1 The response follows the standard List object structure:JSON{
  "object": "list",
  "results": [ /* array of block objects */ ],
  "has_more": false, // boolean indicating if more results exist
  "next_cursor": null // string cursor for the next page, or null
}
Pagination is essential for handling pages with more than 100 blocks (the default maximum page_size). If has_more is true, the next_cursor value should be passed as the start_cursor query parameter in a subsequent request to fetch the next page of results.1 Refer to the Pagination reference for details.A critical aspect of reading page content is handling nested blocks. When a block in the results array has its has_children property set to true, its own children are not included in the current response. To retrieve them, a separate, recursive call to the Retrieve Block Children endpoint must be made using the ID of that specific block.1This recursive, paginated nature means that retrieving the complete content of a complex, deeply nested Notion page is not a single API call. It requires logic that:
Fetches the top-level blocks (children of the page).
Handles pagination to get all top-level blocks.
Iterates through the retrieved blocks.
For each block where has_children is true, recursively calls the endpoint to fetch its children (again, handling pagination).
Reconstructs the hierarchical structure of the page content from these sequential fetches.
This process can involve numerous API requests, especially for large pages. Therefore, implementing efficient retrieval might necessitate asynchronous operations (like background job queues) and careful management of API(https://developers.notion.com/reference/errors#rate-limits), potentially incorporating delays or backoff strategies if limits are hit.1 LLMs or the code interacting with them must be prepared to build the full content tree level by level as data arrives from these potentially numerous API calls.curl and JavaScript examples demonstrate basic retrieval.11.6. Appending Blocks to a PageNew content can be added to an existing page or block using the(https://developers.notion.com/reference/patch-block-children).1This endpoint requires the block_id of the parent (e.g., the page ID) in the path and a children array in the request body, containing the new block objects to be added.1JSON// Example children array for appending

    }
  }
]
By default, the new blocks are appended to the end of the parent's existing children list.1The API also provides an optional after parameter within the request body (as a sibling to the children array). If provided, this parameter should contain the ID of an existing child block within the parent. The new blocks specified in the children array will then be inserted immediately after the block identified by the after parameter.1JSON// Example request body using 'after'
{
  "children": [ /* new block objects */ ],
  "after": "<block_id_to_append_after>"
}
This after parameter is the primary mechanism for inserting content at specific points rather than just at the end. There is no API method to insert at an arbitrary index (like position 0 for the beginning) directly. Inserting at the beginning would require complex workarounds, potentially involving retrieving all existing blocks, deleting them (if feasible and atomic operations are not guaranteed), and then re-appending them in the desired order including the new block – likely an inefficient process. Using after requires the integration to know the ID of the preceding block. If this ID isn't readily available (e.g., from a previous read operation or stored state), a call to Retrieve Block Children might be necessary first to identify the correct block ID to use in the after parameter, adding latency to the insertion process.1The response to a successful append request typically contains the updated parent block object, but it does not include the newly added children themselves. The has_children property of the parent block may be updated if it was previously false.1Full curl and JavaScript examples are provided in the documentation.11.7. Page Content SummaryInteracting with page content revolves around the block model. Blocks form a hierarchical structure, with pages being top-level blocks. Content is described using arrays of rich text objects. Key API operations include creating pages with initial content, recursively reading block hierarchies while handling pagination, and appending new blocks either at the end or after a specific existing block. Understanding block types, rich text, pagination, recursion, permissions, and API limits is essential for robust integration.12. Working with DatabasesNotion databases provide a powerful way to organize pages as structured data entries. They support various property types, views, filters, and sorts.2 The API allows integrations to interact with database structures (schemas) and the pages (items) within them.2.1. Overview of DatabasesDatabases are essentially collections of Notion pages, where each page represents an item or row. The structure is defined by a set of properties (columns).2 Integrations commonly use database APIs to synchronize data between Notion and external systems (like CRMs, project management tools, or custom databases) or to build automated workflows triggered by or acting upon database changes.22.1.1. Additional Database Types (Limitations)Beyond standard databases, Notion features two special types with API limitations:
Linked Databases: These display the content of a source database elsewhere in the workspace, often with different views or filters. They are identifiable in the UI by a ↗ icon next to the title.2 The API does not currently support direct interaction with linked databases. Integrations must operate on the original source database. This necessitates that integrations guide users to share the source database, as users might mistakenly share a linked version. Error handling or validation might be needed to detect if a provided ID belongs to a linked database, if possible via API metadata, or clear user instructions are required.2

Wiki Databases: These are specialized databases for organizing knowledge, featuring a homepage view and page verification capabilities managed by Workspace Owners. Pages within a wiki have a verification property.2 Wiki databases can only be created through the Notion UI, not the API. While pages within a wiki might be accessible via standard page/database endpoints, wiki-specific features like managing verification status are not currently exposed through the API. This limits the ability of integrations to fully automate wiki management workflows.2
2.2. Database Structure and SchemaThe structure of a database is represented by the Database object. Key fields include id, created_time, last_edited_time, title (as a rich text array), description (rich text array), and most importantly, the properties object which defines the schema.2JSON{
  "object": "database",
  "id": "2f26ee68-df30-4251-aad4-8ddc420cba3d",
  "created_time": "...",
  "last_edited_time": "...",
  "title": [/* rich text array */],
  "description": [/* rich text array */],
  "properties": { /* collection of property objects defining the schema */ },
  "archived": false,
  "in_trash": false,
  "is_inline": false,
  "public_url": null
  //... other metadata...
}
Notion recommends a maximum database schema size of 50KB to maintain performance. Updates attempting to create excessively large schemas might be blocked by the API.2 This suggests potential issues with integrations interacting with databases having hundreds of properties or extremely complex configurations, reinforcing the need for robust error handling.2.2.1. Database Properties (Schema Definition)The properties object within the Database object maps property names (as seen in the Notion UI, e.g., "Task Name", "Due Date", "Status") to Property objects that describe each column.2Each property object includes:
id: A stable identifier for the property.
type: The data type of the property (e.g., title, rich_text, number, select, multi_select, date, people, files, checkbox, url, email, phone_number, formula, relation, rollup, created_time, created_by, last_edited_time, last_edited_by, status, verification).
A key matching the type value, containing type-specific configuration (e.g., number object with format, select object with options array).2
Example properties structure:JSON"properties": {
  "Grocery item": { // Property Name (Key)
    "id": "fy:{",     // Property ID
    "type": "title",  // Property Type
    "title": {}       // Type-specific configuration (empty for title)
  },
  "Price": {
    "id": "dia\\R

Understanding the database schema is crucial before interacting with its pages. Adding pages requires constructing property values that match the schema types and configurations. Querying pages involves referencing property names or IDs in filters and sorts. Therefore, integrations designed to work with arbitrary user-selected databases should first retrieve the database schema using the(https://developers.notion.com/reference/retrieve-a-database).[2] This allows the integration to dynamically adapt to the specific structure of the target database. Iterating over the `properties` object in the response provides the necessary information about each property's name, ID, type, and configuration.[2]

### 2.3. Adding Pages to a Database

Pages within a database represent individual items or rows. They are created using the same(https://developers.notion.com/reference/post-page) used for non-database pages.[2]

Key differences when creating database pages:
*   The `parent` parameter must be a database parent: `{ "type": "database_id", "database_id": "<database_id>" }`.[2]
*   The `properties` parameter is mandatory and must provide values for database properties, conforming strictly to the database's schema defined in the parent Database object.[2] Keys in the `properties` object should be either the property *name* or the property *ID*. Values must be [Property Value objects](https://developers.notion.com/reference/page-property-values) matching the type defined in the schema.[2]

Example `properties` object for adding a page to the sample database schema:

```json
{
  "Grocery item": { // Referencing property by Name
    "type": "title",
    "title":
  },
  "Price": { // Referencing property by Name
    "type": "number",
    "number": 1.49
  },
  "Last ordered": { // Referencing property by Name
    "type": "date",
    "date": { "start": "2021-05-11" }
  }
  // Or using IDs:
  // "fy:{": {... title value... },
  // "dia[": {... number value... },
  // "]\\R[": {... date value... }
}
As mentioned previously, the integration must have permission to access the parent database.2 Database IDs can be found manually or via API search.2Crucially, for robust integrations that work with various user databases, the properties object should be constructed dynamically. The recommended workflow is:
Retrieve the database schema using GET /v1/databases/{database_id}.
Parse the properties from the schema to understand the required fields, their types, and IDs.
Construct the properties object for the POST /v1/pages request based on the retrieved schema and the data to be inserted.2
This dynamic approach ensures the integration remains functional even if the user modifies the database structure (e.g., renames properties, changes types). Relying on hardcoded property names is brittle. Using property IDs (obtained from the schema) instead of names when constructing the request is generally more resilient to user renaming actions.2
A successful creation returns the new Page object. It is advisable to store the returned page_id, as it is needed for any future updates to that page's properties via the(https://developers.notion.com/reference/patch-page).2curl and JavaScript examples are available.22.4. Finding Pages in a Database (Querying)To retrieve pages from a database based on specific criteria, use the(https://developers.notion.com/reference/post-database-query).2 (If you already know the specific page ID, use the(https://developers.notion.com/reference/retrieve-a-page) instead 2).The query endpoint accepts optional filter and sorts parameters in the request body to control which pages are returned and in what order.
Filtering (filter): This parameter takes a Filter object. Filters specify conditions based on database properties.

Simple filters apply a condition to a single property (e.g., "Status" equals "Done", "Due Date" is after today).
Compound filters combine multiple conditions using and or or arrays, allowing for complex logic.2
Filter structures are type-specific (e.g., date filters use keys like past_week, on_or_after; text filters use contains, equals). Constructing valid filters requires knowledge of the database schema (property names/IDs and types).2
Omitting the filter parameter retrieves all pages in the database (subject to pagination).2
Example filter (matches pages where "Last ordered" date is in the past week):

JSON{
  "property": "Last ordered", // Property Name or ID
  "date": {
    "past_week": {}
  }
}


Sorting (sorts): This parameter takes an array of(https://developers.notion.com/reference/post-database-query-sort). Each sort object specifies a property or a timestamp to sort by and a direction (ascending or descending).2

Sorting can be based on database properties (e.g., sort by "Priority" property).
Sorting can also use built-in timestamps: created_time or last_edited_time.2
Example sort (newest created pages first):

JSON[
  {
    "timestamp": "created_time",
    "direction": "descending"
  }
]


The response from the query endpoint is a paginated List object, containing the matching Page objects in the results array.2 Pagination works identically to block retrieval (has_more, next_cursor, start_cursor, page_size). Handling pagination is essential when querying databases that might contain more than 100 items to ensure all relevant data is processed.2 Sorting is particularly important in paginated scenarios to maintain a consistent order across multiple page fetches.curl and JavaScript examples demonstrate querying with filters and sorts.22.5. Database SummaryDatabases organize pages using a schema defined by properties. The API allows retrieving this schema, adding new pages that conform to it, and querying existing pages using powerful filter and sort capabilities. Key considerations for integrations include handling API limitations (linked/wiki databases), dynamically adapting to database schemas, managing permissions, and correctly implementing pagination for queries.23. Working with CommentsNotion allows users to collaborate via comments, which can be attached to entire pages or specific blocks within a page, forming discussion threads.3 The API provides capabilities for integrations to read and add comments.3.1. Overview of CommentsComments can appear at the top level of a page or inline, associated with specific text or blocks. Inline comments can initiate discussion threads.3 The API enables integrations to participate in these discussions programmatically.3.2. Permissions and CapabilitiesInteracting with comments via the API requires satisfying two layers of authorization:
Page Permissions: The integration must be granted appropriate access to the page itself through Notion's standard sharing mechanism (e.g., Can comment, Can edit, Full access). A minimum of Can comment is typically needed for adding comments.3
Integration Capabilities: The integration must be explicitly configured with comment-related capabilities in its settings page (www.notion.so/my-integrations). The relevant capabilities are Read comments (to retrieve comments) and Insert comments (to add comments).3
API requests will fail if either the necessary page permission or the required integration capability is missing.3 Integrations should request the appropriate capabilities during setup and guide users on granting sufficient page permissions.3.3. API vs. UI Functionality ComparisonThe API's comment functionality is a subset of what users can do through the Notion interface. Key differences include 3:FeatureSupported in UISupported via APIAdd Page CommentYesYesStart Inline DiscussionYesNoRespond to Inline DiscussionYesYesRead Open CommentsYesYesRead Resolved CommentsYesNoEdit CommentYesNoResolve/Re-open CommentYesNoThe most significant limitations for integrations are the inability to:
Start new inline discussion threads on specific blocks or text.
Retrieve or interact with resolved comments.
Edit existing comments.
These constraints mean that certain workflows cannot be fully automated. For instance, an integration cannot automatically add a comment to a specific sentence unless a discussion thread already exists there. It also cannot access the full historical context if comments have been resolved.3 Developers should monitor the Notion API Changelog for potential future enhancements.33.4. Retrieving CommentsTo fetch open (unresolved) comments associated with a page or a specific block, use the(https://developers.notion.com/reference/get-comments).3
The block_id query parameter identifies the target (a page ID is valid here).3
The endpoint returns a paginated list of Comment objects.3
The response is a flat list, ordered chronologically ascending. If a block has multiple discussion threads, comments from all threads are included in this single list.3
Individual discussion threads can be identified and grouped by the discussion_id field present on each comment object.3
Pagination follows the standard pattern (start_cursor, page_size, default max 100).3
Because the API returns a flat list, integrations needing to display or process comments thread-by-thread must implement logic to group the retrieved comment objects based on their discussion_id.3 Remember, only open comments are returned; resolved comment history is inaccessible via the API.3curl and JavaScript examples are provided.33.5. Adding Page CommentsTo add a new top-level comment to a page, use the(https://developers.notion.com/reference/create-comment).3The request body requires:
parent: An object specifying the page ID: { "page_id": "<page_id>" }.3
rich_text: An array of rich text objects defining the comment's content.3
Example request body:JSON{
  "parent": {
    "page_id": "59e3eb41-33b2-4151-b05b-31115a15e1c2"
  },
  "rich_text": [
    {
      "text": {
        "content": "Hello from my integration."
      }
    }
  ]
}
A successful response contains the full Comment object for the newly created comment.3 However, there's an edge case: if the integration has the Insert comments capability but lacks the Read comments capability, the response will be a partial object containing only the id and object fields. This highlights the interplay between capabilities; for the most straightforward experience (getting the full object back), requesting both capabilities is advisable.3In the Notion UI, the comment will appear attributed to the integration's name and icon.3curl and JavaScript examples are available.33.6. Responding to Inline DiscussionsThe same(https://developers.notion.com/reference/create-comment) is used to add a reply to an existing inline discussion thread.3The critical difference lies in the request body parameter used for targeting:
Instead of parent.page_id, provide the discussion_id of the thread you want to reply to.3
The rich_text parameter defines the content of the reply.3
Example request body for a reply:JSON{
  "discussion_id": "59e3eb41-33b2-4151-b05b-31115a15e1c2", // ID of the existing thread
  "rich_text":
}
Remember, this endpoint can only be used for replies; it cannot initiate a new inline discussion.3To obtain the necessary discussion_id:
Programmatically: Retrieve existing comments using GET /v1/comments and extract the discussion_id from a comment belonging to the target thread.3
Manually: In the Notion UI, find the discussion, click the ••• menu next to a comment in the thread, select "Copy link to discussion", and parse the URL. The discussion_id is the value of the d query parameter (e.g., ...?d={discussion_id}#...).3
Correctly switching between parent.page_id (for page comments) and discussion_id (for replies) is essential for placing comments accurately.3 Replying to a specific discussion inherently requires a preliminary step to acquire the relevant discussion_id.3curl and JavaScript examples are provided.33.7. Comments SummaryThe API allows reading open comments and adding new ones, either at the page level or as replies to existing inline threads. Key limitations include the inability to start new inline threads, edit comments, or access resolved comments. Successful interaction depends on both page permissions and integration capabilities. Retrieving comments yields a flat list requiring client-side grouping by discussion_id for thread reconstruction.34. Working with Files and MediaNotion pages and databases frequently incorporate files, images, videos, and other media. The API handles these differently depending on whether they are hosted externally or by Notion itself.44.1. Overview of Files and MediaFiles and media can appear as page covers, icons, dedicated blocks (image, video, file, embed), or within Files type properties in databases.44.2. External Files (Recommended)Integrations can add files and media hosted on external servers (e.g., your own S3 bucket, a CDN, a public file hosting service) to Notion pages and properties.4
Adding: This is done by providing a secure, publicly accessible URL to the asset within the relevant API request (e.g., when creating an image block or updating a file property). The structure typically involves specifying type: "external" and providing the URL within an external object.4 Refer to the File Object reference for exact structures.
Hosting: The developer or user is responsible for hosting the file and ensuring the URL remains valid and accessible.4
Retrieving: When reading Notion content via the API, external files are represented by the static, persistent URL originally provided.4
This approach is recommended because it offers stability and control. The URLs do not expire, simplifying management for integrations that handle their own assets.44.3. Notion-Hosted FilesFiles uploaded directly to Notion through the UI are stored and hosted by Notion.4
Uploading: Crucially, the API currently does not support uploading new files directly to Notion's hosting. This is a significant limitation.4 Integrations needing to add new files must typically upload them to an external host first and then add them to Notion as external files (see Section 4.2).
Retrieving: When content containing Notion-hosted files is fetched via the API, the file object includes a temporary, expiring public URL pointing to the file on Notion's servers (e.g., an S3 URL).4
URL Expiry: These URLs are regenerated frequently (typically hourly) and expire after a short period (usually one hour). The exact expiration time is provided in the expiry_time property alongside the url within the file object (file type).4
Example Notion-hosted file object structure (within a block or property value):
JSON{
  "type": "file",
  "file": {
    "url": "[https://s3.us-west-2.amazonaws.com/secure.notion-static.com/.../asset.png](https://s3.us-west-2.amazonaws.com/secure.notion-static.com/.../asset.png)?...",
    "expiry_time": "2023-10-27T11:00:00.000Z" // Example expiry time
  }
}


Warning: Because these URLs expire, they should not be stored or statically referenced for long-term use. Attempting to access a URL after its expiry_time will fail. Integrations needing to access Notion-hosted files must re-fetch the relevant Notion page or block via the API to obtain a fresh, valid URL whenever access is required, or at least check the expiry_time before attempting to use a cached URL.4
The volatility of Notion-hosted file URLs necessitates careful handling in applications that display or process this content, preventing long-term caching of these specific URLs.44.4. Files and Media SummaryThe API distinguishes between externally hosted files (stable URLs, recommended, added via URL) and Notion-hosted files (temporary expiring URLs, retrieved via API, cannot be uploaded via API). The lack of API upload support for Notion hosting is a key limitation, often requiring a workaround involving external hosting.45. Conclusion: Key Concepts for LLM Development with Notion APISuccessfully leveraging the Notion API, particularly for LLM-driven applications, requires understanding several core concepts and constraints derived from the examined documentation:
Block-Based Architecture: Content is fundamentally structured as hierarchical blocks. Reading requires recursive fetching, and writing involves constructing block objects.1
Structured vs. Unstructured Data: Utilize page properties for structured data (especially within databases) and page content (blocks) for free-form information.1
Schema Awareness: Interacting with databases necessitates retrieving and understanding their schema (properties) to correctly add or query pages.2 Dynamic adaptation to schemas is crucial for robust integrations.
Rich Text Complexity: Textual content uses rich text arrays, requiring specific handling for formatting, mentions, and links.1
Identifier Management: Stable IDs (page, block, database, property, discussion) are central to API operations. Prefer IDs over mutable names where possible.1
Permissions and Capabilities: Actions are gated by both user-granted page permissions and integration-specific capabilities configured by the developer.1
Pagination: Assume all list endpoints are paginated and implement logic to handle has_more and next_cursor for complete data retrieval.1
API Limitations: Be aware of unsupported features compared to the UI (e.g., certain blocks, linked databases, file uploads, comment actions like starting inline threads or reading resolved history). Design workflows accordingly.1
File Handling: Understand the difference between stable external file URLs and expiring Notion-hosted file URLs, and the lack of API upload capability for the latter.4
Rate and Size Limits: Design integrations to be mindful of API rate limits and payload size limits, potentially using asynchronous processing, batching, or delays.1
By incorporating these principles, developers can build more effective and resilient integrations that leverage the Notion API to connect with LLMs and automate workflows involving Notion content and data.