const transferEvents = require('./toERC20TransferEvent.json')
const burnEvents = require('./burnAccounts.json')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const transactons = new FileSync('transactions.json')
const db = low(transactons);
let transactionsToBrun = []

let transferEventsMap = new Map();

console.log("START");

for (transferEvent in transferEvents) {
	transferEventsMap.set(transferEvents[transferEvent].transactionHash, transferEvents[transferEvent])
}
console.log(transferEventsMap.size)
for (burnEvent in burnEvents) {
	const txHashBurn = burnEvents[burnEvent].transactionHash;

	if (transferEventsMap.has(txHashBurn)) {
		console.log(txHashBurn)
		transferEventsMap.delete(txHashBurn)

	}
}
db.set('MAP', transferEventsMap).write()
console.log(transferEventsMap)
console.log(transferEventsMap.size)

console.log("END");