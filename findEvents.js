const fs = require("fs");
const BigNumber = require("bignumber.js");
const Web3 = require("web3");
if (!process.env.WEB3_URL) throw new Error("WEB3_URL not set");
const provider = new Web3.providers.WebsocketProvider(process.env.WEB3_URL, {
    clientConfig: {
        maxReceivedFrameSize: 100000000,
        maxReceivedMessageSize: 100000000
    }
});
const web3 = new Web3(provider);
provider.on('error', error => {
    console.error('error', error);
    throw error;
});
provider.on('end', error => {
    console.error('end', error);
    throw error;
});

const TOKEN_CONTRACT = "0x5ca9a71b1d01849c0a95490cc00559717fcf0d1d";
const tokenAbi = require('human-standard-token-abi');
const tokenContract = new web3.eth.Contract(tokenAbi, TOKEN_CONTRACT);

const TOKEN_BURN_CONTRACT = "0x8a3B7094e1D80C8366B4687cB85862311C931C52";
const burnAbi = require('./tokenBurnerAbi.json');
const burnContract = new web3.eth.Contract(burnAbi, TOKEN_BURN_CONTRACT);

const step = 100000;
const range = (firstBlock, lastBlock) => {
    const range = [];
    for (i = firstBlock; i <= lastBlock; i += step) range.push(i);
    return range;
};

const findBurnEvents = async (firstBlock, lastBlock) =>
    range(firstBlock, lastBlock).reduce(async (accPromise, cur) => {
        const acc = await accPromise;
        const events = await burnContract.getPastEvents("Burn", {fromBlock: cur, toBlock: cur + step});
        console.log("findBurnEvents", cur, cur + step, events.length);
        return acc.concat(events);
    }, Promise.resolve([]));

const findTransferEventsToBurnContract = async (firstBlock, lastBlock) =>
    range(firstBlock, lastBlock).reduce(async (accPromise, cur) => {
        const acc = await accPromise;
        const events = await tokenContract.getPastEvents("Transfer", {
            fromBlock: cur,
            toBlock: cur + step,
            filter: {_to: TOKEN_BURN_CONTRACT}
        });
        console.log("findTransferEventsToBurnContract", cur, cur + step, events.length);
        return acc.concat(events);
    }, Promise.resolve([]));


const findTransferEventsToTokenContract = async (firstBlock, lastBlock) =>
    range(firstBlock, lastBlock).reduce(async (accPromise, cur) => {
        const acc = await accPromise;
        const events = await tokenContract.getPastEvents("Transfer", {
            fromBlock: cur,
            toBlock: cur + step,
            filter: {_to: TOKEN_CONTRACT}
        });
        console.log("findTransferEventsToTokenContract", cur, cur + step, events.length);
        return acc.concat(events);
    }, Promise.resolve([]));


const main = async () => {
    const burnEvents = await findBurnEvents(6682073, 8515749);
    const burnTransactionHashes = burnEvents.map(e => e.transactionHash);
    console.log("burnEvents", burnEvents.length, "\n");

    const transferEventsToBurnContract = await findTransferEventsToBurnContract(6682073, 8515749);
    console.log("transferEventsToBurnContract", transferEventsToBurnContract.length, "\n");

    const nonBurnTransfersToBurnContract = transferEventsToBurnContract.filter(e => !burnTransactionHashes.includes(e.transactionHash));
    console.log("nonBurnTransfersToBurnContract", nonBurnTransfersToBurnContract.length, "\n");

    const transferEventsToTokenContract = await findTransferEventsToTokenContract(4231524, 8515749);
    console.log("transferEventsToTokenContract", transferEventsToTokenContract.length, "\n");

    return {
        nonBurnTransfersToBurnContract: nonBurnTransfersToBurnContract,
        transferEventsToTokenContract: transferEventsToTokenContract
    }
};

main().then(({nonBurnTransfersToBurnContract, transferEventsToTokenContract}) => {
    const write = (file, events) => {
        fs.writeFileSync(file, JSON.stringify(events.reduce((acc, cur) => {
            const prev = new BigNumber(acc[cur.returnValues._from] ? acc[cur.returnValues._from] : 0);
            acc[cur.returnValues._from] = prev.plus(cur.returnValues._value).toFixed();
            return acc;
        }, {}), null, 2));
    };

    write("./nonBurnTransfersToBurnContract.json", nonBurnTransfersToBurnContract);
    write("./transferEventsToTokenContract.json", transferEventsToTokenContract);

    process.exit();
});
