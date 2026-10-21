export type CipherAction = 'encrypt' | 'decrypt';
export interface CryptoParameters {
  key: string;
  keyFormat: string;
  iv: string;
  format: string;
  rsaKey: string;
  rsaFormat: string;
  sm2Key: string;
  sm2Format: string;
  sm2Prefix: string;
}
export interface ToolResult {
  output: string;
  info?: string;
  json?: boolean;
}
export interface ToolContext {
  value: string;
  action: string;
  option: string;
  variant: string;
  jwtKey: string;
  parameters: CryptoParameters;
}
export interface ToolDefinition {
  id: string;
  title: string;
  options: string[];
  optionLabel?: string;
  variants?: (option: string) => string[];
  actions: (option: string) => Array<{ label: string; id: string }>;
  run: (context: ToolContext) => ToolResult | Promise<ToolResult>;
  markdown?: boolean;
  reuseOutput?: boolean;
  autoAction?: string;
  hint: string | ((option: string, variant: string) => string);
}
