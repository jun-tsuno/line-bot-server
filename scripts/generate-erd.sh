#!/bin/bash

# Generate ER diagram from DBML schema
echo "Generating ER diagram..."

# Create output directory if it doesn't exist
mkdir -p _llm-docs/diagrams

# Generate SQL from DBML
echo "Generating SQL schema..."
pnpm exec dbml2sql schema.dbml -o _llm-docs/diagrams/schema.sql

# Format the generated SQL
echo "Formatting SQL..."
pnpm exec sql-formatter _llm-docs/diagrams/schema.sql -o _llm-docs/diagrams/schema.sql

echo "ER diagram generation complete!"
echo ""
echo "Generated files:"
echo "- _llm-docs/diagrams/schema.sql (Formatted SQL)"
echo "- _llm-docs/diagrams/er-diagram.mermaid (Mermaid diagram)"
echo ""
echo "To visualize the Mermaid diagram, use:"
echo "- GitHub (automatically renders .mermaid files)"
echo "- VS Code with Mermaid extension"
echo "- Online Mermaid Live Editor: https://mermaid.live"