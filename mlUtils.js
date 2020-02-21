const normalizeArray = (inputArray)=>{
    const min = Math.min(...inputArray);
    let positive = inputArray.map(e=> e + Math.abs(min) );
    let max = Math.max(...positive);
    const offset = Math.min(...positive);
    positive = positive.map(e=> e - offset);
    const normalizedArray = positive.map(e=> (e / ( max - offset))||0 );
    return {offset, min, max, data:normalizedArray};
}

const deNormalizeArray = (param, options)=>{ // param can be Object or Array
    // if param is Object everything (data, min, max and offset) will be in param
    // else params will be Array with normalized elements and options will be rest of the parametrers (min, max and offset)
    let {data, min, max, offset} = param;

    if(!data){ // set the variables if data is empty
        data = param;
        min = options.min;
        max = options.max;
        offset = options.offset;
    } 
    const scaledArray = data.map(e=> e * ( max - offset ) );
    const positive = scaledArray.map(e=> e + offset);
    const deNormalizedArray = positive.map(e=> e - Math.abs(min))
    return deNormalizedArray;
}

const serializeArray = (normalizedArray)=>{
    const flatArray =[];
    normalizedArray[0].data.forEach((_,index)=>{
        const row = normalizedArray.map(row=>row.data[index]);
        flatArray.push(row);
    })
    return flatArray;
}
const makeXYPair = ({normalizedArray, yIndex=0, batchSize=50, offset=10})=>{ 
    // normalizedArray is 2D array [rows x [pointValues]]
    // yIndex is the index of the value to be predicted
    // batchSize number of rows per training 

    const flatArray = serializeArray(normalizedArray);
    const x =[];
    const y =[];
    for(let i=0;i<flatArray.length-batchSize-offset;i++){
        const rows =[];
        for(let j=i;j<i+batchSize;j++){
            rows.push(flatArray[j])
        }
        x.push(rows);
        y.push(flatArray[i+batchSize+offset][yIndex]);
    }
    return ({x,y});
}

module.exports={
    normalizeArray,
    deNormalizeArray,
    makeXYPair,
}

// const {min,max,data} = normalizeArray([-10,-9,3,4,5, -5]);
// console.log("Normal",data);
// console.log("De Normal",deNormalizeArray(data, min, max));