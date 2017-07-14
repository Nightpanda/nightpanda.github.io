//** Made by Pekka Tiilikainen 2017, all rights reserved for now.*/

function findGridStartBy([x, y]){
    const yStart = (y - y%3);
    const xStart = (x - x%3);
    return {x: xStart, y: yStart};
}

function locationOfNumberInNeighborArrays(neighbors, number){
    let locations = [];
    neighbors.rows.map(rowObject => {
        locations.push([rowObject.index, rowObject.row.indexOf(number)]);
    });
    neighbors.columns.map(columnObject => {
        locations.push([columnObject.column.indexOf(number), columnObject.index]);
    });
    return locations;
}

function findNumberIndexesInArray(number, array){
    return array.reduce((indices, value, index) => {
        if (value == number){
            indices.push(index);
            return indices;
        }
        return indices;
    }, []);
}

function columnToArray(columnIndexToCheck, sudoku){
    var columnArray = [];
    for (var i = 0; i < 9; i++){
        columnArray.push(sudoku[i][columnIndexToCheck]);
    }
    return columnArray;
}

function gridToArray(xCoord, yCoord, sudoku){
    const startCoordinates = findGridStartBy([xCoord, yCoord]);
    const yStart = startCoordinates.y;
    const xStart = startCoordinates.x;
    let gridArray = [];
    for (var x = xStart; x < xStart + 3; x++){
        for (var y = yStart; y < yStart + 3; y++){
            gridArray.push(sudoku[x][y]);
        }
    }
    return gridArray;
}

function getSudokuNumbers(){
    return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

function createAllowedGridCoordinatesByStartIndex(start){
    return [start, start+1, start+2];
}

function isArrayValid(array){
    return array.map(number => {
        if (number != 0){
            return findNumberIndexesInArray(number, array).length > 1;
        }
    }).indexOf(false) != -1;
}

function isSudokuFull(sudoku){
    for (var row = 0; row < 9; row++){
        if (sudoku[row].includes(0)) {
            return false;
        }
    }
    return true;
}

function isSudokuValid(sudoku){
    return sudoku.map((row, rowIndex) => {
        if (!isArrayValid(row)){
            console.log("Sudoku not valid at row " + rowIndex);
            return false;
        }
        row.map((number, columnIndex) => {
            let column = columnToArray(columnIndex, sudoku);
            if (!isArrayValid(column)){
                console.log("Sudoku not valid at column " + columnIndex);
                return false;
            }
            let grid = gridToArray(rowIndex, columnIndex, sudoku);
            if (!isArrayValid(grid)){
                console.log("Sudoku not valid at grid " + grid);
                return false;
            }
        }); 
    }).indexOf(false) != -1;
}

function solveObvious(sudoku){
    while (!isSudokuFull(sudoku)){
        let possibilities = getPossibilities(sudoku);
        possibilities.forEach(possibility => {
            if (possibility.possibilities.length == 1 && possibility.numberAtLocation == 0){
                let number = possibility.possibilities[0];
                let y = possibility.coordinate.y;
                let x = possibility.coordinate.x;
                sudoku[x][y] = number;
                DrawSudoku(sudoku);
            }
        });
    }
    return sudoku;
}

function throwIfInvalid(sudoku){
    if (isSudokuValid(sudoku)){
        throw "Sudoku was not valid anymore";
    }
}

/** Method that draws the entire sudoku in ascii*/
function DrawSudoku(sudoku){
    throwIfInvalid(sudoku);
    sudoku.forEach(row => {
        let rowString = row.reduce((string, number) => {
            if (number == 0) {
                return string+" "; 
            }
            return string+number; 
        }, "");
        console.log(rowString);
        
    }, this);
    return sudoku;
}

function getPossibilities(sudoku){
    let allPossibilities = [];
    sudoku.map((row, x) => {
        row.map((number, y) => {
            let possibilities = possibilitiesAtlocation(x,y,sudoku);
            allPossibilities.push({
                coordinate: {
                    x: x,
                    y: y
                },
                numberAtLocation: number,
                possibilities: possibilities
            });
        });
    });
    return allPossibilities;
}

function possibilitiesAtlocation(x, y, sudoku){
    const blocked = blockedAtLocation(x, y, sudoku);
    return getSudokuNumbers().filter(number => !blocked.has(number));
}

function blockedAtLocation(x, y, sudoku){
    const column = locationColumnNumbers(y, sudoku);
    const row = locationRowNumbers(x, sudoku);
    const grid = locationGridNumbers(x, y, sudoku);
    return new Set(column.concat(row, grid));
}

function locationColumnNumbers(columnIndex, sudoku){
    return sudokuNumbersInArray(columnToArray(columnIndex, sudoku));
}

function locationRowNumbers(rowIndex, sudoku){
    return sudokuNumbersInArray(sudoku[rowIndex]);
}

function locationGridNumbers(x, y, sudoku){
    return sudokuNumbersInArray(gridToArray(x, y, sudoku));
}


function sudokuNumbersInArray(array){
    return array.filter(number => number != 0);
}

if (typeof module !== "undefined" && module.exports != null) {
    exports.findGridStartBy = findGridStartBy;    
    exports.locationOfNumberInNeighborArrays = locationOfNumberInNeighborArrays;
    exports.findNumberIndexesInArray = findNumberIndexesInArray;
    exports.columnToArray = columnToArray;
    exports.gridToArray = gridToArray;
    exports.getSudokuNumbers = getSudokuNumbers;
    exports.createAllowedGridCoordinatesByStartIndex = createAllowedGridCoordinatesByStartIndex;
    exports.solveObvious = solveObvious;
    exports.isSudokuFull = isSudokuFull;
    exports.isArrayValid = isArrayValid;
    exports.isSudokuValid = isSudokuValid;
    exports.DrawSudoku = DrawSudoku;
    exports.getPossibilities = getPossibilities;
    exports.possibilitiesAtlocation = possibilitiesAtlocation;
    exports.blockedAtLocation = blockedAtLocation;
}

/**
 * Create a matrix that contains the sudoku grid
*/
function CreateEmptySudoku(){
    let sudoku = [];
    for (var i = 0; i < 9; i++){
        var emptyArray = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        sudoku.push(emptyArray);
    }
    return sudoku;
}

/** Create the whole sudokuGrid, grid by grid*/
function CreateSudoku(){
    let sudoku = CreateEmptySudoku();

    for (var gridX = 0; gridX < 9; gridX += 3){
        var gridStartX = gridX;
        for (var gridY = 0; gridY < 9; gridY += 3){
            var numbersArray = randomizeSudokuNumbers();
            var gridStartY = gridY;

            for (var j = 0; j < 9; j++){
                //Go through the numbers one at a time
                var numberToPlace = numbersArray[j];

                //We can't move forward untill we have placed the number, go through the coordinateArray untill a suitable place has been found
                for (var x = 0; x < 3; x++){
                    var rowIndex = gridStartX+x;
                    let currentRow = sudoku[rowIndex];
                    if (currentRow.includes(numberToPlace)){ //if the row is taken, move to the next, no need to check column
                        continue;
                    }
                    for (var y = 0; y < 3; y++){
                        var columnIndex = gridStartY + y;
                        let currentColumn = columnToArray(columnIndex, sudoku);
                        if (currentColumn.includes(numberToPlace)){ //If the column is taken, no need to check the grid
                            continue;
                        }
                        if (gridToArray(rowIndex, columnIndex, sudoku).includes(numberToPlace)){
                            continue;
                        } else {
                            if (sudoku[rowIndex][columnIndex] == 0){
                                sudoku[rowIndex][columnIndex] = numberToPlace;
                                break;
                            }
                            else {
                                continue;
                            }
                        }
                    }
                }
            }
        }
    }
    return sudoku;
}

/** Randomize sudoku numbers in array */
function randomizeSudokuNumbers(){
    let sudokuNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let randomizedSudokuNumbers = RandomizeArrayContent(sudokuNumbers);
    sudokuNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return randomizedSudokuNumbers;
}

/** Randomize an array content*/
function RandomizeArrayContent(array){
    var changedArray = [];
    while (array.length > 0){
        let number = array.splice(RandomizeNumber(0, array.length+1), 1)[0];
        changedArray.push(number);
    }
    return changedArray;
}

function RandomizeNumber(min, max){
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (min - max)) + min; //min (inclusive), max (exclusive)
}

function randomizeSudokuNumber(){
    return Math.floor(Math.random() * (9 - 1)) + 1; //min (inclusive), max (exclusive)
}

/** Check through the sudoku if there is a 0, do it again, see how many counts it does to make a sudoku */
function createAndDrawSudoku(){
    let count = 0;
    let sudokuReady = false;
    let sudoku = [];
    while (!sudokuReady){
        sudoku = CreateSudoku();
        count++;
        sudokuReady = isSudokuFull(sudoku);
    }
    console.log("It took " + count + " iterations to create this sudoku.");
    return DrawSudoku(sudoku);
}



if (typeof module !== "undefined" && module.exports != null) {
    exports.CreateEmptySudoku = CreateEmptySudoku;
    exports.createAndDrawSudoku = createAndDrawSudoku;
    exports.randomizeSudokuNumbers = randomizeSudokuNumbers;
    exports.randomizeSudokuNumber = randomizeSudokuNumber;
}

function reduceSudoku(sudoku){
    console.log("Reducing rows...");
    let reducedSudoku = findCompleteRowsAndRemoveNumberFrom(sudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reducing columns...");
    reducedSudoku = findCompleteColumnsAndRemoveNumberFrom(reducedSudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reducing grids...");
    reducedSudoku = findCompleteGridsAndRemoveNumberFrom(reducedSudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reducing by obvious neighbors...");
    reducedSudoku = findObviousNeighborsAndDeleteUsedNumberByRandomFrom(reducedSudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reducing by only place in row or column...");
    reducedSudoku = findObviousByOnlyPlaceLeftAndRemove(reducedSudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reducing by only place inside grid if neighboring row or column taken...");
    reducedSudoku = findObviousBlockedByColumnsOrRowsAndOnlyPlace(reducedSudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reducing numbers based on the location row, column and grid blocking all other options.");
    reducedSudoku = findLocationHasNoOtherOptionAndRemove(reducedSudoku);
    DrawSudoku(reducedSudoku);
    console.log("Reduce location with two possibilities by knowing the not current number possibility is going to be obviously used in row, grid or column.");
    reducedSudoku = findLocationHasOnlyTwoOptionsAndTheOtherIsBlocked(reducedSudoku);
    return DrawSudoku(reducedSudoku);
}

/** Warning, this mutates original sudoku! */
function findCompleteGridsAndRemoveNumberFrom(sudoku) {
    for (var gridX = 0; gridX < 9; gridX += 3) {
        for (var gridY = 0; gridY < 9; gridY += 3) {
            if (!gridToArray(gridX, gridY, sudoku).includes(0)) {
                let randX = Math.floor(Math.random() * (3 - 0)) + 0;
                let randY = Math.floor(Math.random() * (3 - 0)) + 0;
                sudoku[gridX+randX][gridY+randY] = 0;
            }
        }
    }
    return sudoku;
}

function findCompleteRowsAndRemoveNumberFrom(sudoku){
    return sudoku.map(row => {
        return row.includes(0) ? row : removeRandomFromArray(row);
    });
}

function findCompleteColumnsAndRemoveNumberFrom(sudoku){
    for (var y = 0; y < 10; y++){
        const currentColumn = columnToArray(y, sudoku);
        if (!currentColumn.includes(0)) {
            const numberToRemove = randomizeSudokuNumber();
            const rowNumber = currentColumn.indexOf(numberToRemove);
            sudoku[rowNumber] = removeFromArray(sudoku[rowNumber], numberToRemove);
            return sudoku;
        }
    }    
}

function removeRandomFromArray(array){
    return removeFromArray(array, randomizeSudokuNumber());
}

/** Removes a specified number from the array and replaces it with 0 according 
 * to our sudoku syntax. */
function removeFromArray(array, toRemove){
    return array.map(number => {
        return number == toRemove ? 0 : number;
    });
}

function findNeighborRows(x, xStart, sudoku){
    switch (x) {
    case xStart:
        return [
            {index: xStart+1, row: sudoku[xStart+1]},
            {index: xStart+2, row: sudoku[xStart+2]}
        ];
    case xStart+1:
        return [
            {index: xStart, row: sudoku[xStart]},
            {index: xStart+2, row: sudoku[xStart+2]}
        ];
    case xStart+2:
        return [
            {index: xStart, row: sudoku[xStart]},
            {index: xStart+1, row: sudoku[xStart+1]}
        ];
    }
}

function findNeighborColumns(y, yStart, sudoku){
    switch (y) {
    case yStart:
        return [
            {index: yStart+1, column: columnToArray(yStart+1,sudoku)},
            {index: yStart+2, column: columnToArray(yStart+2, sudoku)}
        ];
    case yStart+1:
        return [
            {index: yStart, column: columnToArray(yStart,sudoku)},
            {index: yStart+2, column: columnToArray(yStart+2, sudoku)}
        ];
    case yStart+2:
        return [
            {index: yStart, column: columnToArray(yStart,sudoku)},
            {index: yStart+1, column: columnToArray(yStart+1, sudoku)}
        ];
    }
}


function findNeighborArrays(x, y, sudoku){
    const startCoordinates = findGridStartBy([x, y]);
    const yStart = startCoordinates.y;
    const xStart = startCoordinates.x;
    return {
        rows: findNeighborRows(x, xStart, sudoku),
        columns: findNeighborColumns(y, yStart, sudoku)
    };
}

function isObviousByNeighbors(x, y, sudoku){
    const number = sudoku[x][y];
    const neighbors = findNeighborArrays(x, y, sudoku);
    const rowsBlocked = isNeighborRowsBlocked(neighbors.rows, number);
    const columnsBlocked = isNeighborColumnsBlocked(neighbors.columns, number);
    return (rowsBlocked && columnsBlocked);
}

function isNeighborRowsBlocked(rows, number){
    return rows.filter(rowObject => rowObject.row.includes(number)).length == 2;
}

function isNeighborColumnsBlocked(columns, number){
    return columns.filter(columnObject => columnObject.column.includes(number)).length == 2;
}

function findObviousNeighborsAndDeleteUsedNumberByRandomFrom(sudoku){
    sudoku.map((row, x) => {
        row.map((number, y) => {
            if (isObviousByNeighbors(x, y, sudoku) && number != 0){
                let neighbors = findNeighborArrays(x, y, sudoku);
                let coordinates = locationOfNumberInNeighborArrays(neighbors, number);                
                let randCoordinateIndex = Math.floor(Math.random() * (coordinates.length - 0)) + 0;
                let randCoordinate = coordinates[randCoordinateIndex];
                let randX = randCoordinate[0];
                let randY = randCoordinate[1];
                sudoku[randX][randY] = 0;
            }
        });
    });
    return sudoku;
}

function findObviousByOnlyPlaceLeftAndRemove(sudoku){
    sudoku.map((row, x) => {
        row.map((number, y) => {
            if (number != 0){
                if (isObviousInRowByOnlyPlace(x, y, sudoku)){
                    sudoku[x][y] = 0;
                } else if (isObviousInColumnByOnlyPlace(x, y, sudoku)){
                    sudoku[x][y] = 0;
                }
            }
        });
    });
    return sudoku;
}

function isObviousInColumnByOnlyPlace(x, y, sudoku){
    const column = columnToArray(y, sudoku);
    const number = sudoku[x][y];
    if(number != 0){
        let indexes = findNumberIndexesInArray(0, column);
        let candidateRowsContainNumber = indexes.map(index => {
            return sudoku[index].includes(number);
        });
        return candidateRowsContainNumber.indexOf(false) == -1;
    }
}

function isObviousInRowByOnlyPlace(x, y, sudoku){
    const number = sudoku[x][y];
    const row = sudoku[x];
    if(number != 0){
        let indexes = findNumberIndexesInArray(0, row);
        let candidateColumnsContainNumber = indexes.map(index => {
            return columnToArray(index, sudoku).includes(number);
        });
        return candidateColumnsContainNumber.indexOf(false) == -1;
    }
}

function findObviousBlockedByColumnsOrRowsAndOnlyPlace(sudoku){
    sudoku.map((row, x) => {
        row.map((number, y) => {
            if (number != 0){
                let neighbors = findNeighborArrays(x, y, sudoku);
                if (isBlockedInGridByRowsOrColumns(neighbors, number, sudoku, x, y)){
                    sudoku[x][y] = 0;
                }
            }
        });
    });
    return sudoku;
}

function isBlockedInGridByRows(neighbors, number, sudoku, x){
    if (isNeighborRowsBlocked(neighbors.rows, number)){
        let gridRow = neighbors.columns.map(columnObject => {
            return sudoku[x][columnObject.index];
        });
        if (gridRow.indexOf(0) == -1){
            return true;
        }
    }
    return false;
}

function isBlockedInGridByColumns(neighbors, number, sudoku, y){
    if (isNeighborColumnsBlocked(neighbors.columns, number)){
        let gridColumn = neighbors.rows.map(rowObject => {
            return sudoku[rowObject.index][y];
        });
        if (gridColumn.indexOf(0) == -1){
            return true;
        }
    }
    return false;
}

function isBlockedInGridByRowsOrColumns(neighbors, number, sudoku, x, y){
    return (isBlockedInGridByRows(neighbors, number, sudoku, x) || isBlockedInGridByColumns(neighbors, number, sudoku, y));
}

function findLocationHasNoOtherOptionAndRemove(sudoku){
    sudoku.map((row, x) => {
        row.map((number, y) => {
            if(locationHasNoOtherOptions(x, y, sudoku)){
                sudoku[x][y] = 0;
            }
        });
    });
    return sudoku;
}

function findLocationHasOnlyTwoOptionsAndTheOtherIsBlocked(sudoku){
    let allPossibilities = getPossibilities(sudoku);
    allPossibilities.forEach(possibility => {
        if (possibility.possibilities.length == 1 && possibility.numberAtLocation != 0){
            let x = possibility.coordinate.x;
            let y = possibility.coordinate.y;
            let blockedNumber = possibility.possibilities[0];
            if (isObviousByOnlyTwoOptionsAndTheOtherIsBlockedBySinglePossibility(x, y, allPossibilities, blockedNumber)){
                sudoku[x][y] = 0;
            }
        }
    });
    return sudoku;
}

function isObviousByOnlyTwoOptionsAndTheOtherIsBlockedBySinglePossibility(x, y, allPossibilities, blockingNumber){
    const gridStart = findGridStartBy([x,y]);
    let allowedGridX = createAllowedGridCoordinatesByStartIndex(gridStart.x);
    let allowedGridY = createAllowedGridCoordinatesByStartIndex(gridStart.y);
    return allPossibilities.some(possibilityToCheck => {
        if (possibilityToCheck.coordinate.x == x || 
            possibilityToCheck.coordinate.y == y || 
            allowedGridX.indexOf(x) != -1 ||
            allowedGridY.indexOf(y) != -1) {
            return (possibilityToCheck.numberAtLocation == 0 &&
             possibilityToCheck.possibilities.length == 1 &&
             possibilityToCheck.possibilities.indexOf(blockingNumber) != -1);
        }
    });
}

function listPossibilities(sudoku){
    sudoku.map((row, x) => {
        row.map((number, y) => {
            let possibilities = possibilitiesAtlocation(x,y,sudoku);
            if (possibilities.length == 1 && number != 0){
                console.log("At [" + x + "," +  y + "] possibilities: " + possibilities + " and the number currently " + number);
            } else if(possibilities.length == 1 && number == 0){
                console.log("At [" + x + "," +  y + "] possibilities: " + possibilities + " and the number currently " + number);
            }
        });
    });
}

function locationHasNoOtherOptions(x, y, sudoku){
    const blocked = blockedAtLocation(x, y, sudoku);
    let result = getSudokuNumbers().map(number => {
        if (!blocked.has(number)){
            return false;
        }
    });
    return result.indexOf(false) == -1;
}

if (typeof module !== "undefined" && module.exports != null) {
    exports.removeFromArray = removeFromArray;
    exports.findCompleteRowsAndRemoveNumberFrom = findCompleteRowsAndRemoveNumberFrom;
    exports.findCompleteColumnsAndRemoveNumberFrom = findCompleteColumnsAndRemoveNumberFrom;
    exports.reduceSudoku = reduceSudoku;
    exports.findCompleteGridsAndRemoveNumberFrom = findCompleteGridsAndRemoveNumberFrom;
    exports.findNeighborArrays = findNeighborArrays;
    exports.isObviousByNeighbors = isObviousByNeighbors;
    exports.isObviousInRowByOnlyPlace = isObviousInRowByOnlyPlace;
    exports.isObviousInColumnByOnlyPlace = isObviousInColumnByOnlyPlace;
    exports.isBlockedInGridByRows = isBlockedInGridByRows;
    exports.isBlockedInGridByColumns = isBlockedInGridByColumns;
    exports.locationHasNoOtherOptions = locationHasNoOtherOptions;
    exports.isObviousByOnlyTwoOptionsAndTheOtherIsBlockedBySinglePossibility = isObviousByOnlyTwoOptionsAndTheOtherIsBlockedBySinglePossibility;
    exports.listPossibilities = listPossibilities;
}