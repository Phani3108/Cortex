/**
 * Provider Spec Registry — the ground truth of how each AI coding tool
 * actually consumes context.
 *
 * This is the MOAT. Every provider has different:
 * - File paths it reads
 * - Formats it understands
 * - Token/size limits
 * - Features it supports
 * - Models it runs on
 *
 * If we get this wrong, we're generating files into the void.
 * If we get this right, we're the only tool that actually works.
 */

export const PROVIDER_SPECS = {

  claude: {
    name: 'Claude Code',
    slug: 'claude',
    verified: true,
    contextFiles: [
      {
        path: 'CLAUDE.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Project-level instructions, always loaded into context',
        maxSize: null, // No hard limit, but token budget applies
        alwaysLoaded: true,
        hierarchical: true, // Parent CLAUDE.md files also loaded from ancestor dirs
      },
      {
        path: '.claude/settings.local.json',
        location: 'project_root',
        format: 'json',
        purpose: 'Local settings (permissions, ignore paths)',
        alwaysLoaded: true,
      },
      {
        path: '.claude/commands/{name}.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Custom slash commands (project-scoped)',
        alwaysLoaded: false,
      },
      {
        path: '~/.claude/commands/{name}.md',
        location: 'user_home',
        format: 'markdown',
        purpose: 'Custom slash commands (global)',
        alwaysLoaded: false,
      },
    ],
    tokenLimits: {
      contextWindow: 200000,  // Claude Sonnet/Opus
      instructionBudget: null, // CLAUDE.md has no hard limit
    },
    features: {
      memory: true,           // Claude remembers across sessions
      projectContext: true,    // Reads project files
      customInstructions: true,
      mdcFormat: false,
      yamlFrontmatter: false,
      subAgents: true,         // Can spawn sub-agents for parallel work
      hooks: true,             // Pre/post command hooks
      customSlashCommands: true, // .claude/commands/*.md
      githubActions: true,      // Can run as CI agent
      worktrees: true,          // Parallel sessions via git worktrees
      mcpServers: true,         // Model Context Protocol server support
    },
    models: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3.5'],
    learnFrom: [
      // Where to find signals that Claude sessions produced
      { type: 'file', path: 'CLAUDE.md', what: 'user_edited_instructions' },
      { type: 'git',  pattern: 'CLAUDE.md', what: 'instruction_evolution' },
      { type: 'dir',  path: '.claude/commands/', what: 'custom_commands' },
    ],
    adaptationStrategy: 'markdown_sections',
  },

  cursor: {
    name: 'Cursor',
    slug: 'cursor',
    verified: true,
    contextFiles: [
      {
        path: '.cursor/rules/{name}.mdc',
        location: 'project_root',
        format: 'mdc',  // Markdown with YAML frontmatter
        purpose: 'Rule files with glob matching and auto-apply settings',
        maxSize: null,
        alwaysLoaded: false, // Depends on globs + alwaysApply
        primary: true, // This is now the recommended format
      },
      {
        path: '.cursorrules',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Legacy global rules file (officially deprecated, still supported)',
        maxSize: null,
        alwaysLoaded: true,
        deprecated: true, // Cursor officially deprecated in favor of .cursor/rules/*.mdc
      },
    ],
    tokenLimits: {
      contextWindow: 128000,
      instructionBudget: 8000, // Practical limit for rules
    },
    features: {
      memory: false,
      projectContext: true,
      customInstructions: true,
      mdcFormat: true,
      yamlFrontmatter: true,
      globMatching: true,     // Rules can target specific file types
      composers: true,        // Cursor has Agent/Composer modes
      planMode: true,         // Plan before executing
      subAgents: true,        // Cursor 2.6+ parallel subagents
      automations: true,      // Cursor 2.6 Automations (event-driven)
      backgroundAgents: true, // Long-running agents
      contextRot: true,       // Known issue: >20 messages degrades quality
    },
    models: ['claude-sonnet-4', 'gpt-4o', 'claude-opus-4', 'cursor-small'],
    learnFrom: [
      { type: 'file', path: '.cursorrules', what: 'user_edited_instructions' },
      { type: 'dir',  path: '.cursor/rules/', what: 'rule_files' },
      { type: 'git',  pattern: '.cursor/**', what: 'rule_evolution' },
    ],
    adaptationStrategy: 'mdc_rules',
    bestPractices: {
      freshChatThreshold: 20, // Start new chat after ~20 messages
      antiLazyPrompt: true,   // Include "do not be lazy" type instructions
      defensiveCommits: true,  // Commit before major AI changes
    },
  },

  copilot: {
    name: 'GitHub Copilot',
    slug: 'copilot',
    verified: true,
    contextFiles: [
      {
        path: '.github/copilot-instructions.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Project-level instructions for Copilot Chat',
        maxSize: 8000, // Characters, not tokens
        alwaysLoaded: true,
      },
      {
        path: '.github/.copilot-codereviewer.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Instructions for Copilot code review',
        alwaysLoaded: false,
      },
      {
        path: '.github/instructions/{name}.instructions.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Scoped instructions with glob-based file matching',
        alwaysLoaded: false,
        globMatching: true, // applyTo front matter for file targeting
      },
    ],
    tokenLimits: {
      contextWindow: 128000,
      instructionBudget: 2000, // ~8000 chars
    },
    features: {
      memory: false,
      projectContext: true,
      customInstructions: true,
      mdcFormat: false,
      yamlFrontmatter: true,  // instructions/*.instructions.md has front matter
      codeReview: true,
      scopedInstructions: true, // Glob-based instruction files
      agentMode: true,          // Copilot agent mode in VS Code
      mcpServers: true,         // MCP server support
      customAgents: true,       // Custom chat participants
    },
    models: ['gpt-4o', 'claude-sonnet-4', 'o3', 'gemini-2.5-pro'],
    learnFrom: [
      { type: 'file', path: '.github/copilot-instructions.md', what: 'user_edited_instructions' },
      { type: 'dir',  path: '.github/instructions/', what: 'scoped_instructions' },
      { type: 'git',  pattern: '.github/copilot*', what: 'instruction_evolution' },
    ],
    adaptationStrategy: 'markdown_concise',
  },

  windsurf: {
    name: 'Windsurf (Codeium)',
    slug: 'windsurf',
    verified: true,
    contextFiles: [
      {
        path: '.windsurfrules',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Project-level rules for Windsurf Cascade',
        maxSize: null,
        alwaysLoaded: true,
      },
      {
        path: '.windsurf/rules/{name}.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Individual rule files with front matter (trigger, scope)',
        alwaysLoaded: false,
        yamlFrontmatter: true,
      },
    ],
    tokenLimits: {
      contextWindow: 128000,
      instructionBudget: 6000,
    },
    features: {
      memory: true,          // Windsurf has Cascade memory
      projectContext: true,
      customInstructions: true,
      mdcFormat: false,
      cascade: true,         // Multi-step agent mode
      flows: true,           // Windsurf Flows for structured workflows
      knowledgeGraph: true,  // Indexed codebase knowledge
    },
    models: ['claude-sonnet-4', 'gpt-4o', 'windsurf-internal'],
    learnFrom: [
      { type: 'file', path: '.windsurfrules', what: 'user_edited_instructions' },
      { type: 'dir',  path: '.windsurf/rules/', what: 'rule_files' },
    ],
    adaptationStrategy: 'markdown_sections',
  },

  antigravity: {
    name: 'Antigravity',
    slug: 'antigravity',
    verified: true,
    contextFiles: [
      {
        path: '.antigravity/instructions.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Project instructions for Antigravity',
        maxSize: null,
        alwaysLoaded: true,
      },
      {
        path: '.agent/skills/{name}.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Workspace-level skills (SKILL.md format, shared across tools)',
        alwaysLoaded: false,
      },
      {
        path: '~/.gemini/antigravity/skills/{name}.md',
        location: 'user_home',
        format: 'markdown',
        purpose: 'Global skills directory',
        alwaysLoaded: false,
      },
    ],
    tokenLimits: {
      contextWindow: 200000,
      instructionBudget: null,
    },
    features: {
      memory: true,
      projectContext: true,
      customInstructions: true,
      mdcFormat: false,
      skills: true,           // SKILL.md format support
      skillBundles: true,     // Organized skill collections
      universalSkillFormat: true, // Skills work across 9+ AI tools
      activationScripts: true,   // Context window management via activation
    },
    models: ['claude-sonnet-4', 'claude-opus-4', 'gpt-4o', 'gemini-pro'],
    learnFrom: [
      { type: 'file', path: '.antigravity/instructions.md', what: 'user_edited_instructions' },
      { type: 'dir',  path: '.agent/skills/', what: 'skill_files' },
    ],
    adaptationStrategy: 'markdown_sections',
  },

  // OpenAI Codex CLI — the actual tool that reads project files
  codex: {
    name: 'OpenAI Codex CLI',
    slug: 'codex',
    verified: true,
    contextFiles: [
      {
        path: 'AGENTS.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Agent instructions for OpenAI Codex CLI',
        maxSize: null,
        alwaysLoaded: true,
        hierarchical: true, // Reads from parent directories too
      },
      {
        path: '.codex/skills/{name}.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Skill files for Codex CLI',
        alwaysLoaded: false,
      },
    ],
    tokenLimits: {
      contextWindow: 200000,
      instructionBudget: null,
    },
    features: {
      memory: false,
      projectContext: true,
      customInstructions: true,
      mdcFormat: false,
      sandboxed: true,
      networkDisabled: true,   // Runs in sandbox with no network by default
      multiModel: true,        // Supports switching between o3, o4-mini, etc.
    },
    models: ['o3', 'o4-mini', 'gpt-4o', 'codex-mini'],
    learnFrom: [
      { type: 'file', path: 'AGENTS.md', what: 'user_edited_instructions' },
      { type: 'dir',  path: '.codex/skills/', what: 'skill_files' },
    ],
    adaptationStrategy: 'markdown_sections',
  },

  gemini: {
    name: 'Gemini CLI',
    slug: 'gemini',
    verified: true,
    contextFiles: [
      {
        path: 'GEMINI.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Project-level instructions for Gemini CLI (always loaded)',
        maxSize: null,
        alwaysLoaded: true,
        hierarchical: true, // Reads from parent dirs + ~/.gemini/GEMINI.md
      },
      {
        path: '~/.gemini/GEMINI.md',
        location: 'user_home',
        format: 'markdown',
        purpose: 'Global instructions for all Gemini CLI sessions',
        alwaysLoaded: true,
      },
      {
        path: '.gemini/settings.json',
        location: 'project_root',
        format: 'json',
        purpose: 'Project settings (theme, history, sandbox)',
        alwaysLoaded: true,
      },
      {
        path: '.gemini/style-guide.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Style guide for Gemini Code Assist (IDE plugin)',
        maxSize: null,
        alwaysLoaded: true,
        variant: 'code-assist', // Only for IDE-based Gemini Code Assist
      },
    ],
    tokenLimits: {
      contextWindow: 2000000, // Gemini 2.5 Pro: 1M, Gemini experimental: 2M
      instructionBudget: null,
    },
    features: {
      memory: true,            // /memory command for persistent memory
      projectContext: true,
      customInstructions: true,
      mdcFormat: false,
      largeContext: true,
      customSlashCommands: true, // TOML-based .gemini/commands/{name}.toml
      extensions: true,         // MCP server extensions
      checkpointing: true,      // Auto-checkpoints for undo
      compress: true,           // /compress command for context management
      yoloMode: true,           // Auto-approve all tool calls
      multiDirectory: true,     // Work across multiple directories
      mcpServers: true,         // Model Context Protocol support
      sandboxed: true,          // Docker/gVisor sandbox support
      ideIntegration: true,     // Works inside VS Code, JetBrains
    },
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    learnFrom: [
      { type: 'file', path: 'GEMINI.md', what: 'user_edited_instructions' },
      { type: 'file', path: '.gemini/style-guide.md', what: 'style_guide' },
      { type: 'git',  pattern: 'GEMINI.md', what: 'instruction_evolution' },
    ],
    adaptationStrategy: 'markdown_verbose', // Gemini benefits from more detail
  },

  // Amazon Kiro — spec-driven development IDE
  kiro: {
    name: 'Amazon Kiro',
    slug: 'kiro',
    verified: true,
    contextFiles: [
      {
        path: '.kiro/rules/{name}.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Product rules and coding guidelines (always-on or on-demand)',
        alwaysLoaded: false, // Depends on frontmatter trigger
        yamlFrontmatter: true,
      },
      {
        path: '.kiro/specs/{name}/requirements.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'User stories with acceptance criteria (auto-generated from prompt)',
        alwaysLoaded: false,
      },
      {
        path: '.kiro/specs/{name}/design.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Technical design with file changes and interfaces',
        alwaysLoaded: false,
      },
      {
        path: '.kiro/specs/{name}/tasks.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Implementation task list with checkboxes',
        alwaysLoaded: false,
      },
    ],
    tokenLimits: {
      contextWindow: 200000,
      instructionBudget: null,
    },
    features: {
      memory: false,
      projectContext: true,
      customInstructions: true,
      mdcFormat: false,
      specDriven: true,         // requirements → design → tasks workflow
      steeringHooks: true,      // Event-driven automation (file_saved, etc.)
      agentHooks: true,         // Pre/post hooks for agent actions
      multiModel: true,         // Claude Sonnet 4, multiple providers
      vibeToSpec: true,         // Convert vibe prompt → formal spec
    },
    models: ['claude-sonnet-4', 'claude-haiku-3.5'],
    learnFrom: [
      { type: 'dir', path: '.kiro/rules/', what: 'rule_files' },
      { type: 'dir', path: '.kiro/specs/', what: 'spec_files' },
    ],
    adaptationStrategy: 'spec_driven',
  },

  // OpenAI ChatGPT — desktop/web app with custom instructions
  openai: {
    name: 'OpenAI ChatGPT',
    slug: 'openai',
    verified: true,
    contextFiles: [
      {
        path: '.openai/instructions.md',
        location: 'project_root',
        format: 'markdown',
        purpose: 'Custom instructions for ChatGPT Desktop with working dir',
        maxSize: null,
        alwaysLoaded: true,
      },
    ],
    tokenLimits: {
      contextWindow: 128000,
      instructionBudget: 4000,
    },
    features: {
      memory: true,            // ChatGPT memory
      projectContext: false,   // Limited project awareness vs coding tools
      customInstructions: true,
      mdcFormat: false,
      canvasMode: true,        // ChatGPT Canvas for code editing
    },
    models: ['gpt-4o', 'o3', 'o4-mini'],
    learnFrom: [
      { type: 'file', path: '.openai/instructions.md', what: 'user_edited_instructions' },
    ],
    adaptationStrategy: 'markdown_concise',
  },
};

/**
 * Model-specific prompting strategies.
 * Different LLMs respond differently to the same instructions.
 * This controls HOW we format rules for each model family.
 */
export const MODEL_STRATEGIES = {

  'claude-family': {
    models: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3.5', 'claude-sonnet', 'claude-opus', 'claude-haiku'],
    formatting: {
      useXmlTags: true,       // Claude responds well to XML structure
      sectionMarkers: 'xml',  // <rules>, <style>, <context>
      listStyle: 'dash',      // - item
      emphasisStyle: 'bold',  // **important**
      instructionTone: 'direct', // "Do X. Don't Y."
    },
    strengths: ['long_context', 'instruction_following', 'code_generation', 'analysis', 'agentic_workflows'],
    promptPattern: 'structured_xml',
    tips: {
      prefillResponse: true,   // Start assistant response to guide format
      useExamples: true,       // Few-shot examples improve output
      chainOfThought: true,    // Ask to think step by step for complex tasks
      avoidAmbiguity: true,    // Direct imperatives over hedging
    },
  },

  'openai-family': {
    models: ['gpt-4o', 'gpt-4-turbo', 'o1', 'o3', 'o4-mini', 'codex-mini'],
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown', // ## Section
      listStyle: 'numbered',     // 1. item
      emphasisStyle: 'caps',     // IMPORTANT:
      instructionTone: 'system', // System prompt style
    },
    strengths: ['reasoning', 'code_generation', 'tool_use', 'structured_output'],
    promptPattern: 'system_prompt',
    tips: {
      leadingWords: true,       // End prompt with start of desired output
      completionBias: true,     // Use completion-style for formatting control
      jsonMode: true,           // Request structured JSON when needed
    },
  },

  'reasoning-family': {
    models: ['o1', 'o3', 'o4-mini'],
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'numbered',
      emphasisStyle: 'caps',
      instructionTone: 'minimal', // Less instruction, more problem statement
    },
    strengths: ['deep_reasoning', 'math', 'complex_code', 'planning'],
    promptPattern: 'problem_statement',
    tips: {
      minimalInstructions: true, // Reasoning models work better with less scaffolding
      problemFocused: true,      // State the problem, let model reason
      avoidChainOfThought: true, // These models do CoT internally
    },
  },

  'gemini-family': {
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro', 'gemini-flash', 'gemini-ultra'],
    formatting: {
      useXmlTags: true,       // Gemini 2.5+ responds well to XML-style tags
      sectionMarkers: 'markdown', // Combine markdown headings with XML tags
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'conversational',
    },
    strengths: ['large_context', 'multimodal', 'reasoning', 'long_documents'],
    promptPattern: 'detailed_markdown',
    tips: {
      contextFirst: true,       // Put context before questions for long contexts
      explicitPlanning: true,   // Ask model to plan before executing
      selfCritique: true,       // Ask model to review its own output
      scopeDefinition: true,    // Be explicit about what's in/out of scope
      consistentFormatting: true, // Pick one tagging style and stick with it
    },
  },

  'open-source': {
    models: ['llama', 'deepseek', 'codestral', 'qwen', 'mistral', 'deepseek-v3'],
    formatting: {
      useXmlTags: false,
      sectionMarkers: 'markdown',
      listStyle: 'dash',
      emphasisStyle: 'bold',
      instructionTone: 'explicit', // More explicit, less implicit
    },
    strengths: ['code_generation', 'fast_inference'],
    promptPattern: 'explicit_markdown',
    tips: {
      shortContext: true,       // Smaller context windows need concise instructions
      explicitConstraints: true, // State constraints clearly
      repeatCritical: true,     // Repeat critical instructions at beginning and end
    },
  },
};

/**
 * Get the model family for a given model name.
 */
export function getModelFamily(modelName) {
  for (const [family, spec] of Object.entries(MODEL_STRATEGIES)) {
    if (spec.models.some(m => modelName.toLowerCase().includes(m.toLowerCase()))) {
      return { family, ...spec };
    }
  }
  return { family: 'unknown', ...MODEL_STRATEGIES['openai-family'] }; // Safe default
}

/**
 * Get the spec for a provider.
 */
export function getProviderSpec(name) {
  return PROVIDER_SPECS[name] || null;
}

/**
 * List all known providers.
 */
export function listProviderSpecs() {
  return Object.entries(PROVIDER_SPECS).map(([key, spec]) => ({
    key,
    name: spec.name,
    verified: spec.verified,
    models: spec.models,
  }));
}
