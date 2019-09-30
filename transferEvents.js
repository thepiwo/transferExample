//@ts-nocheck
// fix required: https://github.com/ethereum/web3.js/issues/1916
const Web3 = require("web3")
const fs = require('fs');
const timestamp = require('time-stamp');
const abi = require('human-standard-token-abi');
const burnerAbi = require('./tokenBurnerAbi.json')

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('toERC20TransferEvent.json')
const burnAccounts = new FileSync('burnAccounts.json')
const db = low(adapter);
const db3 = low(burnAccounts)

const args = require('minimist')(process.argv.slice(2));

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const TOKEN_CONTRACT = "0x5ca9a71b1d01849c0a95490cc00559717fcf0d1d";
const TOKEN_BURN_CONTRACT = "0x8a3B7094e1D80C8366B4687cB85862311C931C52"
const WEB3_URL = process.env.NODE_WEB3_URL || args.n;
const SIZE_CHECKER = "0x52b034d64f150b9d6d39b9a9b9177d8a202e3f3e";
const DEFAULT_START_BLOCK = Number(process.env.NODE_START_BLOCK) || 4231524; //28-05-2019

if (WEB3_URL == null) {
    console.log("No valid Ethereum node found in .env file ('NODE_WEB3_URL'), please provide one with -n flag, like \n $ node remaining_balances-CP-JSON.js -n wss://mainnet.infura.io/ws/v3/*YourAPIkey*");
    process.exit();
}

var provider = new Web3.providers.WebsocketProvider(WEB3_URL, {
    clientConfig: {
        maxReceivedFrameSize: 100000000,
        maxReceivedMessageSize: 100000000
    }
})
var web3 = new Web3(provider)
provider.on('error', error => {
    console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + 'WS Error');
    console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + error);
    throw error;
});
provider.on('end', error => {
    console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + 'WS closed');
    console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + error);
    console.log(error)
    provider = new Web3.providers.WebsocketProvider(WEB3_URL, {
        clientConfig: {
            maxReceivedFrameSize: 100000000,
            maxReceivedMessageSize: 100000000
        }
    })
    web3 = new Web3(provider)
});


const AEToken = new web3.eth.Contract(abi, TOKEN_CONTRACT);
const BurnerContract = new web3.eth.Contract(burnerAbi, TOKEN_BURN_CONTRACT)
const SizeChecker = new web3.eth.Contract([{
    "constant": true,
    "inputs": [{
        "name": "addr",
        "type": "address"
    }],
    "name": "isContract",
    "outputs": [{
        "name": "",
        "type": "bool"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
}], SIZE_CHECKER);
var eventPromises = [];
var eventPromisesBurn = [];
let counter = 0;
console.log("START: " + new Date());

startSearching();
var addressPromises = [];
var balancePromises = [];
var burnPromises = []
async function startSearching() {
    var fromBlock = args.f == null ? DEFAULT_START_BLOCK : args.f;
    let latest = 8472764 // when the ERC20 contract was deployed
    var toBlock = args.t == null ? latest : args.t;

    if (fromBlock > toBlock) {
        console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + "Invalid start and/or end block!");
        process.exit(1);
    }

    let currentBlock = fromBlock;

    while (currentBlock < toBlock) {

        console.log("Starting searching or burner events... block  " + currentBlock);
        let eventPromiseBurn = BurnerContract.getPastEvents("Burn", {
            fromBlock: currentBlock,
            toBlock: currentBlock + 1000
        });

        eventPromisesBurn.push(eventPromiseBurn)

        eventPromiseBurn.then(async (events) => {
            console.log("Found " + events.length + "  burn events");
            let BurnEvenets = [];
            for (var i = 0; i < events.length; i++) {
                let to = events[i].returnValues._to;
                let from = events[i].returnValues._from;
                let blockNumber = events[i].blockNumber;
                let eventDetails = {
                    blockHash: events[i].blockHash,
                    blockNumber: events[i].blockNumber,
                    transactionHash: events[i].transactionHash,
                    event: events[i].event,
                    returnValues: events[i].returnValues,
                }

                burnPromises.push(new Promise(async (resolve) => {
                    try {
                        let isContact = await SizeChecker.methods.isContract(from).call();
                        if (!isContact) {
                            console.log("Found holder: " + from + ", current block: " + blockNumber + "Event: Burn");
                            BurnEvenets.push(eventDetails);
                            db3.set(counter, eventDetails).write()
                            counter++;
                        }
                        return resolve();
                    } catch (error) {
                        console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + "Error checking account type: ");
                        console.log(error)
                        fs.appendFileSync("./error.log", error + "\nBLOCK: " + blockNumber + "\nACCOUNT: " + to);
                        resolve();
                        throw error;
                    }
                }));
            }



        }).catch((error) => {
            console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + "Error fetching transfer events: ");
            fs.appendFileSync("./error.log", error + "\nBLOCK: " + cb);
            throw error;
        })

        console.log("Starting searching for transfer... block " + currentBlock);
        let eventPromise = AEToken.getPastEvents("Transfer", {
            fromBlock: currentBlock,
            toBlock: currentBlock + 1000
        });
        eventPromises.push(eventPromise);
        let cb = currentBlock;
        eventPromise.then(async (events) => {
            console.log("Found " + events.length + "  transfer events");
            let addresses = [];
            let burnCounter = 0
            for (var i = 0; i < events.length; i++) {
                let to = events[i].returnValues._to;
                let from = events[i].returnValues._from;
                let blockNumber = events[i].blockNumber;
                let eventDetails = {
                    blockHash: events[i].blockHash,
                    blockNumber: events[i].blockNumber,
                    transactionHash: events[i].transactionHash,
                    event: events[i].event,
                    returnValues: events[i].returnValues,
                }
                if (to == 0x8a3B7094e1D80C8366B4687cB85862311C931C52) { //the recipient should be the token conract
                    addressPromises.push(new Promise(async (resolve) => {
                        try {
                            let isContact = await SizeChecker.methods.isContract(from).call();
                            if (!isContact) {
                                console.log("Found holder: " + from + ", current block: " + blockNumber + "Event: Transfer");
                                addresses.push(from);
                                db.set(burnCounter, eventDetails).write();
                                burnCounter++;
                            }
                            return resolve();
                        } catch (error) {
                            console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + "Error checking account type: ");
                            console.log(error)
                            fs.appendFileSync("./error.log", error + "\nBLOCK: " + blockNumber + "\nACCOUNT: " + to);
                            resolve();
                            throw error;
                        }
                    }));
                }
            }

        }).catch((error) => {
            console.log(`${timestamp('DD.MM.YYYY : HH:mm.ss')} ` + "Error fetching transfer events: ");
            fs.appendFileSync("./error.log", error + "\nBLOCK: " + cb);
            throw error;
        })
        currentBlock += 1000;
    }
    await Promise.all(eventPromises);
    await Promise.all(eventPromiseBurn);
    await Promise.all(burnPromises);
    console.log("END: " + new Date());
    process.exit(0);
}