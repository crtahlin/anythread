import { Bee, Utils, Reference } from '@ethersphere/bee-js'
import { Wallet } from 'ethers'
import { Bytes } from 'mantaray-js'
import { HexEthAddress, STAMP_ID } from '../Utility'

interface DbRecord {
  ethAddresses: HexEthAddress[]
}

function isPirateDbElement(value: unknown): value is DbRecord {
  return value !== null && typeof value === 'object' && Object.keys(value)[0] === 'ethAddresses'
}

function assertPirateDbElement(value: unknown): asserts value is DbRecord {
  if (!isPirateDbElement(value)) {
    throw new Error('PublicPirateDb record is not valid')
  }
}

function deserialiseDbRecord(value: Uint8Array): DbRecord {
  try {
    const valueString = new TextDecoder().decode(value)
    const valueObject = JSON.parse(valueString)
    assertPirateDbElement(valueObject)

    return valueObject
  } catch (e) {
    throw new Error('fetched PublicPirateDb record is not valid')
  }
}

function serializeDbRecord(updateElement: DbRecord): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(updateElement))
}

function mergeRecords(e1: DbRecord, e2: DbRecord): DbRecord {
  const e2EthAddresses = e2.ethAddresses.filter(e => !e1.ethAddresses.includes(e))

  return { ethAddresses: [...e1.ethAddresses, ...e2EthAddresses] }
}

export default class PublicPirateDb {
  constructor(private bee: Bee, private privateKey: Bytes<32>, private topic: Bytes<32>) {}

  public async broadcastEthAddresses(ethAddresses: Utils.EthAddress[]): Promise<Reference> {
    const myUpdate = this.buildUpdate(ethAddresses)
    const lastUpdate = await this.getLatestRecord()
    const update = lastUpdate ? mergeRecords(lastUpdate, myUpdate) : myUpdate
    const feedWriter = this.bee.makeFeedWriter('sequence', this.topic, this.privateKey)
    const { reference } = await this.bee.uploadData(STAMP_ID, serializeDbRecord(update))
    console.log('uploaded swarm reference of the eth address broadcast', reference)

    return feedWriter.upload(STAMP_ID, reference)
  }

  public async getLatestRecord(): Promise<DbRecord | null> {
    const feedReader = this.bee.makeFeedReader('sequence', this.topic, this.privateKey)
    try {
      const feedUpdate = await feedReader.download()
      const data = await this.bee.downloadData(feedUpdate.reference)

      return deserialiseDbRecord(data)
    } catch (e) {
      console.error('error happened at getLastRecord fetch', e)

      return null
    }
  }

  private buildUpdate(addresses: Utils.EthAddress[]): DbRecord {
    const ethAddresses = addresses.map(address => Utils.bytesToHex(address, 40))

    return { ethAddresses }
  }
}
