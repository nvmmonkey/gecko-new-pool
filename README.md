# GeckoTerminal Pool Fetching

This NodeJS program fetch lastest pool from GeckoTerminal for Solana

## Installation

```sh
#install packages
npm i
```



## Running

```sh
#run pogram 
node main.js
```

`minfile.json` is the mint contract extracted from the API

## Setting

`fetch.js` can config filter of dex selection

The following set to true to filter-out dex pool, set to false to show dex pool, track `dex_name.json` and `dex_count.json` to see what or how many dexs you are fetching. `solana_pools.json` contains the raw data fetch from GeckoTerminal, `tbp.json` is the to-be-processed into array-json format, it give much more concised data view than the raw `solana_pools.json`.

```js
//fetch.js
        "raydium": true,
        "fluxbeam": true,
        "dexlab": true,
        "meteora": false,
        "orca": false,
        "raydium-clmm": false
```

## PumpFun Filter

`extract.js` can config filter for pumpdotfun token, set the following SPL contract ending with `pump`

```js
//extrac.js
    if (baseTokenId.endsWith('pump')) 
    //filter token SPL address end with pump
```