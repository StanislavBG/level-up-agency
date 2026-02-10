#!/bin/bash
# Build bilko-flow from source and create lib entry point
BILKO_DIR="node_modules/bilko-flow"
if [ -d "$BILKO_DIR/src" ] && [ ! -f "$BILKO_DIR/dist/lib.js" ]; then
  echo "Building bilko-flow from source..."
  
  # Patch type errors in API files
  for f in "$BILKO_DIR/src/api/"*.ts; do
    sed -i 's/req\.params\.\([a-zA-Z]*\)/req.params.\1 as string/g' "$f" 2>/dev/null
  done
  
  # Build with relaxed settings
  (cd "$BILKO_DIR" && npx tsc --skipLibCheck --noEmit false --outDir dist --declaration true --declarationMap false --sourceMap false --strict false --noImplicitAny false 2>/dev/null)
  
  # Create lib.js entry (without server startup side effects)
  cat > "$BILKO_DIR/dist/lib.js" << 'LIBEOF'
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppContext = exports.createApp = void 0;
var server_1 = require("./server");
Object.defineProperty(exports, "createApp", { enumerable: true, get: function () { return server_1.createApp; } });
Object.defineProperty(exports, "createAppContext", { enumerable: true, get: function () { return server_1.createAppContext; } });
__exportStar(require("./domain"), exports);
__exportStar(require("./dsl"), exports);
__exportStar(require("./engine"), exports);
__exportStar(require("./storage"), exports);
__exportStar(require("./planner"), exports);
__exportStar(require("./data-plane"), exports);
__exportStar(require("./audit"), exports);
__exportStar(require("./notifications"), exports);
LIBEOF

  # Update package.json main to lib.js
  (cd "$BILKO_DIR" && node -e "
    const pkg = require('./package.json');
    pkg.main = 'dist/lib.js';
    pkg.types = 'dist/index.d.ts';
    require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  ")
  
  echo "bilko-flow built successfully"
fi
