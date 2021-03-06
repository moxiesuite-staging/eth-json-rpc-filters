const test = require('tape')
const clone = require('deep-clone')
const RpcBlockTracker = require('eth-block-tracker')
const EthQuery = require('ethjs-query')
const JsonRpcEngine = require('json-rpc-engine')
const asMiddleware = require('json-rpc-engine/src/asMiddleware')
const createBlockRefMiddleware = require('eth-json-rpc-middleware/block-ref')
const TestBlockMiddleware = require('eth-block-tracker/test/util/testBlockMiddleware')
const createScaffoldMiddleware = require('eth-json-rpc-middleware/scaffold')
const createFilterMiddleware = require('../index.js')


process.on('unhandledRejection', function(err){
  throw err
})

filterTest('basic block filter', { method: 'eth_newBlockFilter' },
  function afterInstall(t, testMeta, response, cb){
    testMeta.blockTracker.once('sync', () => cb())
    testMeta.testBlockSource.nextBlock()
  },
  function filterChangesOne(t, testMeta, response, cb){
    const results = response.result
    const returnedBlockHash = results[0]
    t.equal(results.length, 1, 'correct number of results')
    const block = testMeta.blockTracker.getCurrentBlock()
    t.equal(returnedBlockHash, block.hash, 'correct result')
    cb()
  },
  function filterChangesTwo(t, testMeta, response, cb){
    const results = response.result
    t.equal(results.length, 0, 'correct number of results')
    cb()
  }
)

filterTest('log filter - basic', {
    method: 'eth_newFilter',
    params: [{
      topics: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe01']
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx = testMeta.testBlockSource.addTx({
      topics: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe01']
    })
    testMeta.badTx = testMeta.testBlockSource.addTx({
      topics: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe02']
    })
    // add result to matching tx array
    testMeta.matchingTxs.push(clone(testMeta.tx))
    // trigger next block
    testMeta.blockTracker.once('sync', () => cb())
    testMeta.testBlockSource.nextBlock()
  },
  function filterChangesOne(t, testMeta, response, cb){
    const results = response.result
    const matchedTx = response.result[0]
    t.equal(results.length, 1, 'correct number of results')
    t.equal(matchedTx.hash, testMeta.tx.hash, 'correct result')
    cb()
  },
  function filterChangesTwo(t, testMeta, response, cb){
    const results = response.result
    t.equal(results.length, 0, 'correct number of results')
    cb()
  }
)

filterTest('log filter - and logic', {
    method: 'eth_newFilter',
    params: [{
      topics: [
      '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    testMeta.badTx = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      ],
    })
    // add result to matching tx array
    testMeta.matchingTxs.push(clone(testMeta.tx))
    // trigger next block
    testMeta.blockTracker.once('sync', () => cb())
    testMeta.testBlockSource.nextBlock()
  },
  function filterChangesOne(t, testMeta, response, cb){
    const results = response.result
    const matchedTx = response.result[0]
    t.equal(results.length, 1, 'correct number of results')
    t.equal(matchedTx.hash, testMeta.tx.hash, 'correct result')
    cb()
  },
  function filterChangesTwo(t, testMeta, response, cb){
    const results = response.result
    t.equal(results.length, 0, 'correct number of results')
    cb()
  }
)

filterTest('log filter - or logic', {
    method: 'eth_newFilter',
    params: [{
      topics: [
        [
          '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
          '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
        ],
      ],
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx1 = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      ],
    })
    testMeta.tx2 = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    testMeta.badTx = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe03',
      ],
    })
    // add result to matching tx array
    testMeta.matchingTxs.push(clone(testMeta.tx1))
    testMeta.matchingTxs.push(clone(testMeta.tx2))
    // trigger next block
    testMeta.blockTracker.once('sync', () => cb())
    testMeta.testBlockSource.nextBlock()
  },
  function filterChangesOne(t, testMeta, response, cb){
    const results = response.result
    const matchedTx1 = response.result[0]
    const matchedTx2 = response.result[1]
    t.equal(results.length, 2, 'correct number of results')
    t.equal(matchedTx1.hash, testMeta.tx1.hash, 'correct result')
    t.equal(matchedTx2.hash, testMeta.tx2.hash, 'correct result')
    cb()
  },
  function filterChangesTwo(t, testMeta, response, cb){
    const results = response.result
    t.equal(results.length, 0, 'correct number of results')
    cb()
  }
)

filterTest('log filter - wildcard logic', {
    method: 'eth_newFilter',
    params: [{
      topics: [
        null,
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx1 = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    testMeta.tx2 = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    testMeta.badTx = testMeta.testBlockSource.addTx({
      topics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      ],
    })
    // add result to matching tx array
    testMeta.matchingTxs.push(clone(testMeta.tx1))
    testMeta.matchingTxs.push(clone(testMeta.tx2))
    // trigger next block
    testMeta.blockTracker.once('sync', () => cb())
    testMeta.testBlockSource.nextBlock()
  },
  function filterChangesOne(t, testMeta, response, cb){
    const results = response.result
    const matchedTx1 = response.result[0]
    const matchedTx2 = response.result[1]
    t.equal(results.length, 2, 'correct number of results')
    t.equal(matchedTx1.hash, testMeta.tx1.hash, 'correct result')
    t.equal(matchedTx2.hash, testMeta.tx2.hash, 'correct result')
    cb()
  },
  function filterChangesTwo(t, testMeta, response, cb){
    const results = response.result
    t.equal(results.length, 0, 'correct number of results')
    cb()
  }
)

// util

function filterTest(label, filterPayload, afterInstall, filterChangesOne, filterChangesTwo){
  test('filters - '+label, function(t){
    // t.plan(8)

    // install filter
    // new block
    // check filter

    const testMeta = createTestSetup()
    const { engine, blockTracker, provider } = testMeta
    const filterMiddleware = createFilterMiddleware({ blockTracker, provider })
    engine.push(filterMiddleware)

    blockTracker.once('sync', startTest)
    blockTracker.start()


    function startTest(){
      // install block filter
      engine.handle(createPayload(filterPayload), function(err, response){
        t.ifError(err, 'did not error')
        t.ok(response, 'has response')

        const method = filterPayload.method

        // t.equal(filterProvider.getWitnessed(method).length, 1, 'filterProvider did see "'+method+'"')
        // t.equal(filterProvider.getHandled(method).length, 1, 'filterProvider did handle "'+method+'"')

        const filterId = testMeta.filterId = response.result

        afterInstall(t, testMeta, response, function(err){
          t.ifError(err, 'did not error')
          continueTest()
        })
      })
    }

    function continueTest(){
      const filterId = testMeta.filterId
      // after filter check one
      engine.handle(createPayload({ method: 'eth_getFilterChanges', params: [filterId] }), function(err, response){
        t.ifError(err, 'did not error')
        t.ok(response, 'has response')

        // t.equal(filterProvider.getWitnessed('eth_getFilterChanges').length, 1, 'filterProvider did see "eth_getFilterChanges"')
        // t.equal(filterProvider.getHandled('eth_getFilterChanges').length, 1, 'filterProvider did handle "eth_getFilterChanges"')

        filterChangesOne(t, testMeta, response, function(err){
          t.ifError(err, 'did not error')

          // after filter check two
          engine.handle(createPayload({ method: 'eth_getFilterChanges', params: [filterId] }), function(err, response){
            t.ifError(err, 'did not error')
            t.ok(response, 'has response')

            // t.equal(filterProvider.getWitnessed('eth_getFilterChanges').length, 2, 'filterProvider did see "eth_getFilterChanges"')
            // t.equal(filterProvider.getHandled('eth_getFilterChanges').length, 2, 'filterProvider did handle "eth_getFilterChanges"')

            filterChangesTwo(t, testMeta, response, function(err){
              t.ifError(err, 'did not error')
              blockTracker.stop()
              t.end()
            })
          })
        })
      })
    }

  })
}

// util

function createTestSetup () {
  // raw data source
  const { engine: dataEngine, testBlockSource } = createEngineForTestData()
  const dataProvider = providerFromEngine(dataEngine)
  // create block trackerfilterId
  const blockTracker = new RpcBlockTracker({ provider: dataProvider })
  // create higher level
  const engine = new JsonRpcEngine()
  const provider = providerFromEngine(engine)
  // add block ref middleware
  engine.push(createBlockRefMiddleware({ blockTracker }))
  // matching logs middleware
  const matchingTxs = []
  engine.push(createScaffoldMiddleware({ eth_getLogs: matchingTxs }))
  // add data source
  engine.push(asMiddleware(dataEngine))
  const query = new EthQuery(provider)
  return { engine, provider, dataEngine, dataProvider, query, blockTracker, testBlockSource, matchingTxs }
}

function createEngineForTestData () {
  const engine = new JsonRpcEngine()
  const testBlockSource = new TestBlockMiddleware()
  engine.push(testBlockSource.createMiddleware())
  return { engine, testBlockSource }
}

function providerFromEngine (engine) {
  const provider = { sendAsync: engine.handle.bind(engine) }
  return provider
}

function createPayload(payload) {
  return Object.assign({ id: 1, jsonrpc: '2.0', params: [] }, payload)
}
