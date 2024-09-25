function myFunction() {
    /*Idea for how to store the links so it doesnt get out of hand
    Want to store it in a list with dictionary for the items
    Only doing 2023 and 2024 because the other seasons were shorter
    THere will be 2 items for now [ {}, {}]
    In the dictionary it will be:
    - urlStandings: url;year=...
    - urlPower: url;year=...
    - urlAggregate
    - urlGames
    - 
    The urls are stored "https...;year="
    The specific year is added as they are added to the dictionary

    */
    //Getting the URLs for all API links that I want to use in the program
    const listRawUrl = []
    const urlStandings = "https://api.squiggle.com.au/?q=standings;year=";
    listRawUrl.push(urlStandings);
    const urlPower = "https://api.squiggle.com.au/?q=power;source=1;year=";
    listRawUrl.push(urlPower);
    const urlAggregate = "https://api.squiggle.com.au/?q=power;year=";
    listRawUrl.push(urlAggregate);
    const urlGames = "https://api.squiggle.com.au/?q=games"; //Make it so it only gets rounds 25-28
    
    //Storing the URLS in an object(dictionary)
    const allYears = [];
    const url2024 = {};
    const url2023 = {}; 
    const dictKeyNames = ["Standings", "Power", "Aggregate", "Playoffs"];

    //Getting only rounds 25-28, the play off rounds
    const rounds = [25, 26, 27, 28]; //Doing the different rounds
    for (let i = 0; i < rounds.length; i++) {
      temp = urlGames + ";round=" + String(rounds[i]) + ";year="; //Setting the year later with the other urls
      listRawUrl.push(temp); //Pushing the incomplete url to the list of raw urls
    }

    //Storing a temp list of the playoff rounds that I will add to the dictionaries made previously
    const tempPlayoffs2023 = [];
    const tempPlayoffs2024 = [];

    //With the list of raw urls I need to add the specific year to each of these
    //Doing that through a giant for loop, the first goes through every raw url WITHOUT the year added yet
    //The second for loop with then add the respective years im adding to the urls, that is 2023 and 2024
    for (let i = 0; i < listRawUrl.length; i++) {
      for (let j = 2023; j < 2025; j++) {
          temp = listRawUrl[i] + String(j); //Adding the year to the raw url
          temp = JSON.parse(UrlFetchApp.fetch(temp).getContentText()); //Getting the parsed json data
          //Checking the year, then adding the right year to the right dictionary or list if needed
          if (j == 2023) {
            if (i >= 3) {
             tempPlayoffs2023.push(temp); 
            } else {
              url2023[dictKeyNames[i]] = temp;
            }
          } else {
            if (i >= 3) {
             tempPlayoffs2024.push(temp); 
            } else {
              url2024[dictKeyNames[i]] = temp;
            }
          }
      }
    }
    //Manually adding the json data contained in the list to the dictionary then adding it to the master list
    url2024["Playoffs"] = tempPlayoffs2024;
    allYears.push(url2024);
    url2023["Playoffs"] = tempPlayoffs2023;
    allYears.push(url2023);

    //Getting the active spreadsheet 
    const sheet = SpreadsheetApp.getActiveSpreadsheet(); 
    
    //Getting the 2 sheets in that spreadsheet based on the year
    sheetsArray = [];
    const sheet2024 = sheet.getSheetByName("AFL2024");
    sheetsArray.push(sheet2024);
    const sheet2023 = sheet.getSheetByName("AFL2023");
    sheetsArray.push(sheet2023);

    
    //Looping through the dictionary to add to each spreadsheet
    for (let i = 0; i < allYears.length; i++) { //Looping through the years, both sheetsArray and allYears pushed most recent year first
      //Getting all of the values required to put up in the sheet
      const standings = getStandings(allYears[i]["Standings"].standings);
      const power = getPower(allYears[i]["Power"].power);
      power.sort(sortFunction); //Sorting by the first column
      const aggregate = getPowerAggregate(allYears[i]["Aggregate"].power);
      aggregate.sort(sortFunction); //Sorting by the first column

      sheetsArray[i].getRange(3,1, standings.length, standings[0].length).setValues(standings);
      sheetsArray[i].getRange(24,1, power.length, power[0].length).setValues(power);
      sheetsArray[i].getRange(45,1,aggregate.length, aggregate[0].length).setValues(aggregate); 

      getPlayoffs(allYears[i]["Playoffs"], 65, 2, sheetsArray[i], aggregate); //Will print by itself
    }
}

//A function to sort the arrays based on the first column
function sortFunction(a,b) {
    return a[0] - b[0];
}

function getPlayoffs(dataPlayoffs, row, col, sheet, aggregate) {
    playoffs = [];
    //The array dataPlayoffs is in teh form [{game: []}, ...] so I need to go round by round
    for (let i = 0; i < dataPlayoffs.length; i++) { //Looping through the list
        //Ill get all of the games round by round in the form of a dictionary and store it in playoffs
        setGames((dataPlayoffs[i].games),row+i, col, sheet, aggregate);  
    }
}

function setGames(gamesArray, row, col, sheet, aggregate) {
    games = [];
    //Given all of the games from a certain round add them to a list with whats important
    for (let i = 0; i < gamesArray.length; i++) {
        if (gamesArray[i].hteam == null && gamesArray[i].ateam == null) { //If the teams have not been seeded in that round yet
          temp = "TBD";
        }
        else if (gamesArray[i].hteam != null && gamesArray[i].ateam == null) {
          temp = gamesArray[i].hteam + " vs TBD";
        }
        else if (gamesArray[i].hteam == null && gamesArray[i].ateam != null) {
          temp = "TBD vs " + gamesArray[i].ateam;
        }
        else if (gamesArray[i].complete == 0) { //If the game is not complete
          temp = findFavourite(gamesArray[i].ateam, gamesArray[i].hteam, aggregate); //Finding expected winner
        }
        else { //Otherwise the game is done
          temp = gamesArray[i].ateam + " " + gamesArray[i].ascore + ":" + gamesArray[i].hscore + " " + gamesArray[i].hteam;
        }
        games.push(temp); //Adding to the games array
    }
    //Printing the sheet
    sheet.getRange(row, col, 1, gamesArray.length).setValues([games]);
}

function findFavourite(ateam, hteam, aggregate) {
    aPow = 0; //Finding the away power rating
    hPow = 0; //Finding home teams power rating
    counter = 0; //Counter
    //Looping through the list to find the teams power rating, aggregate = [[rating, team_name], ...]
    while (aPow == 0 || hPow == 0) {
      if (aggregate[counter][1] == ateam) {
        aPow = aggregate[counter][0];
      } else if (aggregate[counter][1] == hteam) {
        hPow = aggregate[counter][0];
      }
      counter++; //Updating counter
    }

    //Returning the expected winner with a star beside their name
    if (aPow < hPow) {
      return ateam + "* vs " + hteam;
    } else { //If they have equal scores expect home team to win
      return ateam + " vs " + hteam + "*";
    }
}

function getTeams(teamArray) {
    //Getting the teams from the array which is an array of objects(dictionary)
    teams = [];
    temp = [];
    for (let i = 0; i < teamArray.length; i++) {
        temp = [];
        temp.push(teamArray[i].name); //Trying to make a 2D array
        temp.push(teamArray[i].abbrev); 

        teams.push(temp);
    }
    return teams;
}

function getStandings(standingsArray) {
    //Gettings Rank -> Team name -> GP -> Wins -> Losses -> Draws -> Pts
    standings = [];
    temp = [];
    for (let i = 0; i < standingsArray.length; i++) {
      temp = [];
      temp.push(standingsArray[i].rank);
      temp.push(standingsArray[i].name);
      temp.push(standingsArray[i].played);
      temp.push(standingsArray[i].wins);
      temp.push(standingsArray[i].losses);
      temp.push(standingsArray[i].draws);
      temp.push(standingsArray[i].pts);

      standings.push(temp);

    }
    return standings;
}

function getPower(powerArray) {
    //Getting Proj. Rank -> Team Name -> Power -> Updated
    power = [];
    temp = [];
    //Looping through the array and adding the values to a 2D array
    for (let i = 0; i < powerArray.length; i++) {
      temp = [];
      temp.push(powerArray[i].rank);
      temp.push(powerArray[i].team);
      temp.push(powerArray[i].power);
      temp.push(powerArray[i].updated);
      //Pushing the temp array into the array to be returned
      power.push(temp);

    }
    return power;
}

function getPowerAggregate(powerArray) {
    const aggregate = {};
    const multiple = 19.0; //Need to divide every amount by 19.0 at the end
    //aggregate.powerArray[0].team = powerArray[0].rank; //Adding value to the object first so it doesnt check an empty object
    for (let i = 0; i < powerArray.length; i++) {
      team = powerArray[i].team;
      rank = powerArray[i].rank;
      if (team in aggregate) { //If the team is NOT in the object
        aggregate[team] += rank;
      }
      else {
        aggregate[team] = rank;
      }
    }
    //Dividing all values by 19, the amount of times a value is added
    for (const key in aggregate) {
        val = Math.floor((aggregate[key] / multiple) * 100) / 100; //Truncating at 2 decimal points
        aggregate[key] = val;
    }
    return objToArray(aggregate); //Turning an object into a 2D array
}

//Turning the object in getPowerAggregate to a 2D array
function objToArray(aggregate) {
    agg = [];
    //Looping through every key value pair in the object
    for (const key in aggregate) {
      temp = []; //Resetting the array
      temp.push(aggregate[key]); //The rank
      temp.push(key); // The name of the team
      agg.push(temp);
    }
    return agg;
}
