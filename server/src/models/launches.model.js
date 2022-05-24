const axios = require('axios')
const launches = require('./launches.mongo');
const planets = require('./planets.mongo')

const DEFAULT_FLIGHT_NUMBER = 100

const SPACEX_URL_API = 'https://api.spacexdata.com/v4/launches/query'

async function populateLaunches() {
  console.log('Downloading data ...')
  const response = await axios.post(SPACEX_URL_API, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: 'rocket',
          select: {
            name: 1
          }
        },
        {
          path: 'payloads',
          select: { customers: 1 }
        }
      ]
    }
  })

  if (response.status !== 200) {
    console.log('Problem download data!');
    throw new Error('Launch data download failed!')
  }
  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc['payloads'];
    const customers = payloads.flatMap((payload) => { return payload['customers'] });
    const launch = {
      flightNumber: launchDoc['flight_number'],
      mission: launchDoc['name'],
      rocket: launchDoc['rocket']['name'],
      launchDate: launchDoc['date_local'],
      upcoming: launchDoc['upcoming'],
      success: launchDoc['success'],
      customers,
    }

    console.log(`${launch.flightNumber} ${launch.mission}`)
    await saveLaunch(launch)
  }
}

async function loadLaunchData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: "Falcon 1",
    mission: "FaclonSat"
  })

  if (firstLaunch) {
    console.log('Launch data already loaded');
  } else {
    await populateLaunches()
  }

}

async function findLaunch(filter) {
  return await launches.findOne(filter)
}


async function existsLaunchById(launchId) {
  return await findLaunch({ flightlNumber: launchId })
}

async function getLatestFlightNumber() {
  const latestLaunch = await launches.findOne().sort('-flightNumber')
  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER
  }
  return latestLaunch.flightNumber
}

async function getAllLaunches(skip, limit) {
  return await launches.find({}, { _id: 0, __v: 0 }).sort({ flightNumber: 1 }).skip(skip).limit(limit);
}

async function saveLaunch(launch) {
  await launches.findOneAndUpdate(
    {
      flightNumber: launch.flightNumber,
    },
    launch,
    { upsert: true }
  );
}

async function scheduleNewLaunch(launch) {
  const newFlightNumber = await getLatestFlightNumber() + 1;

  const newLaunch = Object.assign(launch, {
    success: true,
    upcoming: true,
    customer: ['ZTM', 'NASA'],
    flightNumber: newFlightNumber,
  })

  await saveLaunch(newLaunch)
}

async function abortLaunchById(launchId) {
  const aborted = await launches.updateOne({
    flightNumber: launchId
  }, {
    upcoming: false,
    success: false
  })
  return aborted.modifiedCount === 1;
}



module.exports = {
  loadLaunchData,
  existsLaunchById,
  getAllLaunches,
  scheduleNewLaunch,
  abortLaunchById,
};
