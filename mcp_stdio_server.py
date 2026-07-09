"""
OPTIONAL: real MCP (Model Context Protocol) stdio server.

The web dashboard (run.py) does NOT need this file — it uses the lightweight
in-process orchestrator in backend/mcp_server.py so the whole project runs
zero-config, offline, out of the box.

This file is here for judges/teammates who want to demonstrate the 4 tools
over the *actual* MCP protocol, connectable from Claude Desktop or any other
MCP client. It requires the official SDK:

    pip install mcp

Then register it in Claude Desktop's config (claude_desktop_config.json):

    {
      "mcpServers": {
        "ei-nexus-rca": {
          "command": "python3",
          "args": ["/absolute/path/to/mcp_stdio_server.py"]
        }
      }
    }

Run standalone for a quick smoke test:
    python3 mcp_stdio_server.py
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    MCP_SDK_AVAILABLE = True
except ImportError:
    MCP_SDK_AVAILABLE = False

from backend import tools as ei_tools

server = Server("ei-nexus-rca") if MCP_SDK_AVAILABLE else None


def _tool_defs():
    defs = []
    for name, meta in ei_tools.TOOL_REGISTRY.items():
        properties = {}
        required = []
        for param, ptype in meta["schema"].items():
            is_optional = "optional" in ptype
            properties[param] = {"type": "string", "description": ptype}
            if not is_optional:
                required.append(param)
        defs.append(Tool(
            name=name,
            description=meta["description"],
            inputSchema={"type": "object", "properties": properties, "required": required},
        ))
    return defs


if MCP_SDK_AVAILABLE:

    @server.list_tools()
    async def list_tools():
        return _tool_defs()

    @server.call_tool()
    async def call_tool(name: str, arguments: dict):
        if name not in ei_tools.TOOL_REGISTRY:
            raise ValueError(f"Unknown tool: {name}")
        fn = ei_tools.TOOL_REGISTRY[name]["fn"]
        # cast top_k to int if present
        if "top_k" in arguments:
            arguments["top_k"] = int(arguments["top_k"])
        result = fn(**arguments)
        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def main():
        async with stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream, server.create_initialization_options())

    if __name__ == "__main__":
        asyncio.run(main())

else:
    if __name__ == "__main__":
        print("The 'mcp' SDK is not installed. Run: pip install mcp", file=sys.stderr)
        print("The web dashboard (python3 run.py) does not need this package.", file=sys.stderr)
        sys.exit(1)
