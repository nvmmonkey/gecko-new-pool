# Token Data Fetcher
# 代币数据获取器

A Node.js application that fetches and processes Solana token data from both GeckoTerminal and Birdeye APIs.
一个使用 Node.js 开发的应用程序，用于从 GeckoTerminal 和 Birdeye API 获取并处理 Solana 代币数据。

## Installation 安装

```bash
npm install
```

## Usage 使用方法

Run the program 运行程序:
```bash
node main.js
```

## Features 功能特点

### Data Sources 数据来源
- **GeckoTerminal**: Fetches pool data every 5 minutes
  **GeckoTerminal**: 每5分钟获取一次流动池数据
- **Birdeye**: Fetches token data every 6 minutes
  **Birdeye**: 每6分钟获取一次代币数据

### Token Selection 代币选择
- Filter by volume range (Birdeye)
  按交易量范围筛选（Birdeye）
- Select specific number of tokens
  选择指定数量的代币
- Select from a specific index range
  从特定索引范围中选择
- Export all tokens or a subset
  导出所有代币或部分代币

### Output Files 输出文件

#### GeckoTerminal Files GeckoTerminal文件
- `minfileAll.json`: Complete list of token addresses
  所有代币地址的完整列表
- `minfile.json`: Selected token addresses
  已选择的代币地址
- `solana_pools.json`: Raw pool data
  原始流动池数据
- `tbp.json`: Processed token data
  处理后的代币数据

#### Birdeye Files Birdeye文件
- `birdeye_tokens.json`: Raw token data
  原始代币数据
- `tdp_birdeye.json`: Processed token data
  处理后的代币数据
- `minfileAllBirdeye.json`: Complete list of token addresses
  所有代币地址的完整列表
- `tdp_birdeye_selected.json`: Selected tokens with full data
  已选择代币的完整数据
- `minfileBirdeye.json`: Selected token addresses
  已选择的代币地址

## Configuration 配置

### GeckoTerminal DEX Filters DEX过滤器
Set to `true` to exclude, `false` to include DEX pools:
设置为 `true` 排除，`false` 包含 DEX 流动池：

```javascript
DEX_FILTERS: {
    "raydium": true,      // 排除 Raydium
    "fluxbeam": true,     // 排除 Fluxbeam
    "dexlab": true,       // 排除 Dexlab
    "meteora": false,     // 包含 Meteora
    "orca": false,        // 包含 Orca
    "raydium-clmm": false // 包含 Raydium CLMM
}
```

### Birdeye Volume Filters 交易量过滤
- Filter tokens based on 24h volume
  基于24小时交易量筛选代币
- Configurable minimum and maximum volume thresholds
  可配置最小和最大交易量阈值

## Menu Options 菜单选项

1. Select data source 选择数据来源:
   - GeckoTerminal
   - Birdeye

2. When existing data is found 当发现现有数据时:
   - View/select from GeckoTerminal data
     查看/选择 GeckoTerminal 数据
   - View/select from Birdeye data
     查看/选择 Birdeye 数据
   - Fetch new data
     获取新数据

## Auto-Refresh 自动刷新

- GeckoTerminal data refreshes every 5 minutes
  GeckoTerminal 数据每5分钟刷新一次
- Birdeye data refreshes every 6 minutes
  Birdeye 数据每6分钟刷新一次
- Progress countdown is displayed between refreshes
  刷新间隔显示进度倒计时