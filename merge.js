const fs = require("fs");
const BigNumber = require("bignumber.js");

const accountsLeft = JSON.parse(fs.readFileSync("./db-infura-sorted.json", "utf8"));
const toBurnContract = JSON.parse(fs.readFileSync("./nonBurnTransfersToBurnContract.json", "utf8"));
const toTokenContract = JSON.parse(fs.readFileSync("./transferEventsToTokenContract.json", "utf8"));

console.log(Object.keys(accountsLeft).length, Object.keys(toBurnContract).length, Object.keys(toTokenContract).length);


const accounts = Object.keys(accountsLeft).concat(Object.keys(toBurnContract)).concat(Object.keys(toTokenContract));
const allAccounts = accounts.reduce((acc, cur) => {
    const prev = new BigNumber(acc[cur] ? acc[cur] : 0);

    const accountsLeftTokens = new BigNumber(accountsLeft[cur] ? accountsLeft[cur] : 0);
    const toBurnContractTokens = new BigNumber(toBurnContract[cur] ? toBurnContract[cur] : 0);
    const toTokenContractTokens = new BigNumber(toTokenContract[cur] ? toTokenContract[cur] : 0);

    acc[cur] = prev.plus(accountsLeftTokens).plus(toBurnContractTokens).plus(toTokenContractTokens).toFixed();
    return acc;
}, {});

const ordered = {};
Object.keys(allAccounts).sort().forEach(function (key) {
    ordered[key] = allAccounts[key];
});

console.log(accounts.length, Object.keys(allAccounts).length);

fs.writeFileSync("./all-holders-no-duplicates.json", JSON.stringify(ordered, null, 2));
