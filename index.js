const Mutex = require('await-semaphore').Mutex
const EthQuery = require('ethjs-query')
const createJsonRpcMiddleware = require('eth-json-rpc-middleware/scaffold')
const waitForBlock = require('eth-json-rpc-middleware/waitForBlock')
const LogFilter = require('./log-filter.js')
const BlockFilter = require('./block-filter.js')
const TxFilter = require('./tx-filter.js')

module.exports = createEthFilterMiddleware

function createEthFilterMiddleware({ blockTracker, provider }) {

  let filterIndex = 0
  const filters = {}

  const mutex = new Mutex()
  const waitForFree = mutexMiddlewareWrapper({ mutex })

  const ethQuery = new EthQuery(provider)

  blockTracker.on('sync', async ({ oldBlock, newBlock }) => {
    // lock update reads
    const releaseLock = await mutex.acquire()
    // process all filters in parallel
    await Promise.all(objValues(filters).map((filter) => {
      return filter.update({ oldBlock, newBlock })
    }))
    // unlock update reads
    releaseLock()
  })

  return createJsonRpcMiddleware({
    // install filters
    eth_newFilter:                   waitForFree(newLogFilter),
    eth_newBlockFilter:              waitForFree(newBlockFilter),
    eth_newPendingTransactionFilter: waitForFree(newPendingTransactionFilter),
    // uninstall filters
    eth_uninstallFilter:             waitForFree(uninstallFilter),
    // checking filter changes
    eth_getFilterChanges:            waitForFree(getFilterChanges),
    eth_getFilterLogs:               waitForFree(getFilterLogs),
  })

  //
  // new filters
  //

  function newLogFilter(req, res, next, end) {
    const params = req.params[0]
    const filter = new LogFilter({ ethQuery, params })
    const filterIndex = installFilter(filter)
    const result = intToHex(filterIndex)
    res.result = result
    end()
  }

  function newBlockFilter(req, res, next, end) {
    const filter = new BlockFilter({ ethQuery })
    const filterIndex = installFilter(filter)
    const result = intToHex(filterIndex)
    res.result = result
    end()
  }

  function newPendingTransactionFilter(req, res, next, end) {
    const filter = new TxFilter({ ethQuery })
    const filterIndex = installFilter(filter)
    const result = intToHex(filterIndex)
    res.result = result
    end()
  }

  //
  // get filter changes
  //

  function getFilterChanges(req, res, next, end) {
    const filterIndexHex = req.params[0]
    const filterIndex = hexToInt(filterIndexHex)
    const filter = filters[filterIndex]
    if (!filter) {
      const err = new Error('No filter for index "${filterIndex}"')
      return end(err)
    }
    const results = filter.getChangesAndClear()
    res.result = results
    end()
  }

  function getFilterLogs(req, res, next, end) {
    const filterIndexHex = req.params[0]
    const filterIndex = hexToInt(filterIndexHex)
    const filter = filters[filterIndex]
    if (!filter) {
      const err = new Error('No filter for index "${filterIndex}"')
      return end(err)
    }
    const results = filter.getAllResults()
    res.result = results
    end()
  }


  //
  // remove filters
  //


  function uninstallFilter(req, res, next, end) {
    const filterIndexHex = req.params[0]
    const filterIndex = hexToInt(filterIndexHex)
    const filter = filters[filterIndex]
    const results = Boolean(filter)
    delete filters[filterIndex]
    res.result = results
    end()
  }

  //
  // utils
  //

  function installFilter(filter) {
    filterIndex++
    filters[filterIndex] = filter
    return filterIndex
  }

}

function mutexMiddlewareWrapper({ mutex }) {
  return (middleware) => {
    return async (req, res, next, end) => {
      // wait for mutex available
      // we can release immediately because
      // we just need to make sure updates aren't active
      const releaseLock = await mutex.acquire()
      releaseLock()
      middleware(req, res, next, end)
    }
  }
}

function objValues(obj, fn){
  const values = []
  for (let key in obj) {
    values.push(obj[key])
  }
  return values
}

function intToHex(int) {
  return '0x' + int.toString(16)
}

function hexToInt(hex) {
  return Number.parseInt(hex, 16)
}
