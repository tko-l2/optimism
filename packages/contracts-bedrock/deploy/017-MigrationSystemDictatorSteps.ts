import assert from 'assert'

import { ethers } from 'ethers'
import { DeployFunction } from 'hardhat-deploy/dist/types'
import '@eth-optimism/hardhat-deploy-config'
import 'hardhat-deploy'
import { awaitCondition } from '@eth-optimism/core-utils'

import {
  assertContractVariable,
  getContractsFromArtifacts,
  getDeploymentAddress,
} from '../src/deploy-utils'

const deployFn: DeployFunction = async (hre) => {
  const { deployer } = await hre.getNamedAccounts()

  let isLiveDeployer = false
  if (hre.deployConfig.controller === deployer) {
    isLiveDeployer = true
  }

  // Set up required contract references.
  const [
    MigrationSystemDictator,
    ProxyAdmin,
    AddressManager,
    L1CrossDomainMessenger,
    L1StandardBridge,
    L1StandardBridgeWithSigner,
  ] = await getContractsFromArtifacts(hre, [
    {
      name: 'MigrationSystemDictator',
      signerOrProvider: deployer,
    },
    {
      name: 'ProxyAdmin',
      signerOrProvider: deployer,
    },
    {
      name: 'Lib_AddressManager',
      signerOrProvider: deployer,
    },
    {
      name: 'Proxy__OVM_L1CrossDomainMessenger',
      iface: 'OVM_L1CrossDomainMessenger',
      signerOrProvider: deployer,
    },
    {
      name: 'Proxy__OVM_L1StandardBridge',
    },
    {
      name: 'Proxy__OVM_L1StandardBridge',
      signerOrProvider: deployer,
    },
  ])

  // Transfer ownership of the ProxyAdmin to the MigrationSystemDictator.
  if ((await ProxyAdmin.owner()) !== MigrationSystemDictator.address) {
    console.log(`Setting ProxyAdmin owner to MSD`)
    await ProxyAdmin.setOwner(MigrationSystemDictator.address)
  } else {
    console.log(`Proxy admin already owned by MSD`)
  }

  // Transfer ownership of the AddressManager to MigrationSystemDictator.
  if ((await AddressManager.owner()) !== MigrationSystemDictator.address) {
    if (isLiveDeployer) {
      console.log(`Setting AddressManager owner to MSD`)
      await AddressManager.transferOwnership(MigrationSystemDictator.address)
    } else {
      console.log(`Please transfer AddressManager owner to MSD`)
      console.log(`MSD address: ${MigrationSystemDictator.address}`)
    }

    // Wait for the ownership transfer to complete.
    await awaitCondition(async () => {
      const owner = await AddressManager.owner()
      return owner === MigrationSystemDictator.address
    })
  } else {
    console.log(`AddressManager already owned by the MigrationSystemDictator`)
  }

  // Transfer ownership of the L1CrossDomainMessenger to MigrationSystemDictator.
  if (
    (await L1CrossDomainMessenger.owner()) !== MigrationSystemDictator.address
  ) {
    if (isLiveDeployer) {
      console.log(`Setting L1CrossDomainMessenger owner to MSD`)
      await L1CrossDomainMessenger.transferOwnership(
        MigrationSystemDictator.address
      )
    } else {
      console.log(`Please transfer L1CrossDomainMessenger owner to MSD`)
      console.log(`MSD address: ${MigrationSystemDictator.address}`)
    }

    // Wait for the ownership transfer to complete.
    await awaitCondition(async () => {
      const owner = await L1CrossDomainMessenger.owner()
      return owner === MigrationSystemDictator.address
    })
  } else {
    console.log(`L1CrossDomainMessenger already owned by MSD`)
  }

  // Transfer ownership of the L1StandardBridge (proxy) to MigrationSystemDictator.
  if ((await L1StandardBridge.owner()) !== MigrationSystemDictator.address) {
    if (isLiveDeployer) {
      console.log(`Setting L1StandardBridge owner to MSD`)
      await L1StandardBridgeWithSigner.setOwner(MigrationSystemDictator.address)
    } else {
      console.log(`Please transfer L1StandardBridge (proxy) owner to MSD`)
      console.log(`MSD address: ${MigrationSystemDictator.address}`)
    }

    // Wait for the ownership transfer to complete.
    await awaitCondition(async () => {
      const owner = await L1StandardBridge.callStatic.getOwner()
      return owner === MigrationSystemDictator.address
    })
  } else {
    console.log(`L1StandardBridge already owned by MSD`)
  }

  const checks = {
    1: async () => {
      await assertContractVariable(
        ProxyAdmin,
        'addressManager',
        AddressManager.address
      )
      assert(
        (await ProxyAdmin.implementationName(
          getDeploymentAddress(hre, 'Proxy__OVM_L1CrossDomainMessenger')
        )) === 'OVM_L1CrossDomainMessenger'
      )
      assert(
        (await ProxyAdmin.proxyType(
          getDeploymentAddress(hre, 'Proxy__OVM_L1CrossDomainMessenger')
        )) === 2
      )
      assert(
        (await ProxyAdmin.proxyType(
          getDeploymentAddress(hre, 'Proxy__OVM_L1StandardBridge')
        )) === 1
      )
    },
    2: async () => {
      await assertContractVariable(L1CrossDomainMessenger, 'paused', true)
      const deads = [
        'Proxy__OVM_L1CrossDomainMessenger',
        'Proxy__OVM_L1StandardBridge',
        'OVM_CanonicalTransactionChain',
        'OVM_L2CrossDomainMessenger',
        'OVM_DecompressionPrecompileAddress',
        'OVM_Sequencer',
        'OVM_Proposer',
        'OVM_ChainStorageContainer-CTC-batches',
        'OVM_ChainStorageContainer-CTC-queue',
        'OVM_CanonicalTransactionChain',
        'OVM_StateCommitmentChain',
        'OVM_BondManager',
        'OVM_ExecutionManager',
        'OVM_FraudVerifier',
        'OVM_StateManagerFactory',
        'OVM_StateTransitionerFactory',
        'OVM_SafetyChecker',
        'OVM_L1MultiMessageRelayer',
      ]
      for (const dead of deads) {
        assert(
          (await AddressManager.getAddress(dead)) ===
            ethers.constants.AddressZero
        )
      }
    },
    3: async () => {
      await assertContractVariable(AddressManager, 'owner', ProxyAdmin.address)
      await assertContractVariable(
        L1CrossDomainMessenger,
        'owner',
        ProxyAdmin.address
      )
    },
    4: async () => {
      // Empty FOR NOW
    },
    5: async () => {
      await assertContractVariable(L1CrossDomainMessenger, 'paused', false)
    },
    6: async () => {
      await assertContractVariable(
        L1StandardBridge,
        'owner',
        hre.deployConfig.finalSystemOwner
      )
      await assertContractVariable(
        ProxyAdmin,
        'owner',
        hre.deployConfig.finalSystemOwner
      )
    },
  }

  for (let i = 1; i <= 6; i++) {
    if ((await MigrationSystemDictator.currentStep()) === i) {
      if (isLiveDeployer) {
        console.log(`Executing step ${i}...`)
        await MigrationSystemDictator[`step${i}`]()
      } else {
        console.log(`Please execute step ${i}...`)
      }

      await awaitCondition(async () => {
        const step = await MigrationSystemDictator.currentStep()
        return step.toNumber() === i + 1
      })

      // Run post step checks
      await checks[i]()
    } else {
      console.log(`Step ${i} executed`)
    }
  }
}

deployFn.tags = ['MigrationSystemDictatorSteps', 'migration']

export default deployFn
