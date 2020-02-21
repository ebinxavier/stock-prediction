const nodePlotLib = require('nodeplotlib');
const tf = require('@tensorflow/tfjs-node-gpu');
const csv=require('csvtojson')
const moment = require('moment-timezone');
const {normalizeArray, deNormalizeArray, makeXYPair} = require('./mlUtils');

const plot = (data)=>{
    const pollution = {x: data.map((e,i)=>i), y: data.map((e)=>e.pollution), type: 'line'};
    const dew = {x: data.map((e,i)=>i), y: data.map((e)=>e.dew), type: 'line'};
    const temperature = {x: data.map((e,i)=>i), y: data.map((e)=>e.temp), type: 'line'};
    const pressure = {x: data.map((e,i)=>i), y: data.map((e)=>e.press), type: 'line'};
    const windSpeed = {x: data.map((e,i)=>i), y: data.map((e)=>e.wndSpd), type: 'line'};
    nodePlotLib.stack([pollution]);
    nodePlotLib.stack([dew]);
    nodePlotLib.stack([temperature]);
    nodePlotLib.stack([pressure]);
    nodePlotLib.stack([windSpeed]);
    nodePlotLib.plot();
} 

const main = async ({training})=>{

    // Preprocessing 

    const rowData = require('./data'); // Loads the row data
    const stocks = rowData.chart.result[0].indicators.quote[0]; // Taking array of values like below.
    const timeStamps = rowData.chart.result[0].timestamp;
    /* {
        open:[],
        close:[],
        volume:[],
        ...
    }*/
    const plots=[];
    const columns = [
        "open",
        // "volume", 
        "low",
        "high",
        "close",
    ]
    const filteredJSON = columns.map((name)=>stocks[name]); // Removes the key and makes 2D array
    /*
    [
      [...],
      [...],
      ...  
    ]
    */

    filteredJSON.forEach((arr, index)=>{
        plots.push({x:timeStamps.map(time=>moment(time*1000).add(4,'hours')),y:arr, name:columns[index]}); 

    })
    // nodePlotLib.plot(plots);

    // Normalize inputs

    const normalizedArray = filteredJSON.map(row=>{
        return normalizeArray(row)
    })

    // Make X-Y pairs of input
    const yIndex = 0; // the index of element to be predicted.
    const offset = 50;
    const {x,y} = makeXYPair({normalizedArray, yIndex, offset});
    let model;
    
    // Making Neural Network
    
    const dataLength = x.length;
    const predictionCount = 200;
    const trainXTensor = tf.tensor3d(x.slice(0,dataLength-predictionCount));
    const trainYTensor = tf.tensor1d(y.slice(0,dataLength-predictionCount));
    
    const testXTensor = tf.tensor3d(x.slice(dataLength-predictionCount));
    const testYArray = y.slice(dataLength-predictionCount);
    
    if(training){
        model = tf.sequential();

        model.add(tf.layers.lstm({
            units:50, 
            inputShape:[trainXTensor.shape[1],trainXTensor.shape[2]], 
            activation:'relu',
            returnSequences:true,
        }))
        model.add(tf.layers.dropout(0.2));

        model.add(tf.layers.lstm({
            units:60, 
            activation:'relu',
            returnSequences:true,
        }))
        model.add(tf.layers.dropout(0.2));

        model.add(tf.layers.lstm({
            units:80, 
            activation:'relu',
            // returnSequences:true,
        }))
        model.add(tf.layers.dropout(0.15));

        // model.add(tf.layers.lstm({
        //     units:20, 
        //     activation:'relu',
        // }))
        // model.add(tf.layers.dropout(0.2));

        model.add(tf.layers.dense({units:1}))

        model.compile({optimizer:'adam', loss:'meanSquaredError'});

        const history = await model.fit(trainXTensor, trainYTensor,{
            epochs:10,
            batchSize:50
        })
        model.save('file://model');
    } else {
        model = await tf.loadLayersModel('file://model/model.json');
    }
    const result = Array.from(model.predict(testXTensor).dataSync());
    // testYArray.forEach((exp, i)=>{
    //     console.log("Predicted:"+result[i]+" --- Expected: "+exp,"\n-------\n");
    // }) 

    const xAxisTest = result.map((e,i)=>i+normalizedArray[yIndex].data.length - result.length);
    const trainData = normalizedArray[yIndex].data.slice(0,normalizedArray[yIndex].data.length - result.length);
    const train = {name:'train', x:trainData.map((e,i)=>i), y:deNormalizeArray(trainData,normalizedArray[yIndex]), type:'line'};
    const predicted = {name:'predicted', x:xAxisTest.map(e=>e-offset), y:deNormalizeArray(result,normalizedArray[yIndex]), type:'line'};
    const expected = {name:'expected', x:xAxisTest, y:deNormalizeArray(testYArray,normalizedArray[yIndex]), type:'line'};
    nodePlotLib.plot([predicted, expected, train]);
}

main({training:true});

