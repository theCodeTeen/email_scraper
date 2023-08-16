const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const csvWriter = createCsvWriter({
    path:  `${process.argv[2].split(" ").join("-")}.csv`,
    header: [
        {id: 'website', title: 'Website'},
        {id: 'email', title: 'Email'}
    ]
});

async function scrapeWebsiteUrlsFromMaps(url,page){
    let urls=[];

    try{
        let searchMore=true;

        //goto url
        await page.goto(url,{ timeout: 0});
       
        //searching 3 pages per loop
        while(searchMore){
            
            //get urls of 3 pages and a more flag to know if there are more pages
            let [parturls,more] = await page.evaluate(async ()=>{

                //variable inits
                const urls=[];
                let count=0;

                //loop to iterate through 3 pages or available pages which ever is lower
                while(count<3){

                    //get all the list elements
                    let elements = Array.from(document.querySelectorAll(".uQ4NLd"));

                    //iterate over all the list elements
                    for(let i=0;i<elements?.length;i++){

                        //click on selected element
                        elements[i].click();

                        //wait for 2s for infobox to open
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        //get all cta buttons
                        const btns = Array.from(document?.querySelectorAll('.zhZ3gf  .IFmkIb'));

                        //loop over buttons and extract url if website button found
                        let url = null;
                        for(let i=0;i<btns?.length;i++){
                            if(btns[i]?.childNodes[1].textContent=="Website"){
                                url = btns[i]?.parentElement?.href;
                                break;
                            }
                        }

                        //if url found push it to urls array
                        if(url) urls.push(url);
                    }

                    //fetch all navigations button ("prev","next")
                    const nav = Array.from(document.querySelectorAll('.d6cvqb > a > span:nth-child(2)'));
                
                    //search for next button and if found click it
                    let next=false;
                    for(let i=0;i<nav?.length;i++){
                        if(nav[i].textContent=="Next"){
                            next=true;
                            nav[i].click();
                            await new Promise(resolve => setTimeout(resolve, 6000));
                            break;
                        }
                    }

                    //if there is no next page break the loop
                    if(!next) break;

                    //else increment count
                    count++;
                }

                //if count was 3 the its possible to have more pages hence return more as true
                if(count==3) return [urls,true]

                //else false
                return [urls,false];
            });

         //merge newly obtained urls with previously obtained urls
         urls=[...urls,...parturls];

         //assign more to searchMore 
         searchMore=more;
        }

    }catch (error) {
        console.error('Error scraping emails:', error);
    } 

    //returning urls
    return urls;
}
async function scrapeEmailsFromWebsite(url,page) {

    try {
        await page.goto(url);
        const bodyHandle = await page.$('body');
        const bodyText = await page.evaluate(body => body.innerText, bodyHandle);
        await bodyHandle.dispose();

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = bodyText.match(emailRegex) || [];

        return emails;
    } catch (error) {
        console.error('Error scraping emails:', error);
        return [];
    } 
}


async function main() {
    const data = [];

    //base url
    let base_url = `https://www.google.com/search?sca_esv=556502029&rlz=1C1CHBF_enIN1017IN1048&tbs=lf:1,lf_ui:9&tbm=lcl&sxsrf=AB5stBhEfnKhIqF-QUb2y74Ur_egqWETVg:1691921842804&q=${process?.argv[2]?.split(" ")?.join("+")}&rflfq=1&num=10&sa=X&ved=2ahUKEwiN2rWDtNmAAxXEcGwGHRwhCgwQjGp6BAhcEAE&biw=1536&bih=747&dpr=1.25#rlfi=hd:;si:4699039742972410343,a;mv:[[39.0256652,-117.97775379999999],[33.751114699999995,-122.6720864]]`;

    //initialize browser
    const browser = await puppeteer.launch({headless:false,  timeout: 0});

    //open a page
    const page = await browser.newPage();

    //disable timeout
    page.setDefaultNavigationTimeout(0);

    //scrape urls
    const urls = await scrapeWebsiteUrlsFromMaps(base_url,page);
    console.log(urls);

    // Disable loading of CSS, JavaScript files, and images
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (
            request.resourceType() === 'stylesheet' ||
            request.resourceType() === 'font' ||
            request.resourceType() === 'image' ||
            request.resourceType() === 'script'
        ) {
            request.abort();
        } else {
            request.continue();
        }
    });

    for (const url of urls) {
        const emails = await scrapeEmailsFromWebsite(url,page);
        data.push({ website: url, email: emails.join(', ') });
    }
    await csvWriter.writeRecords(data);
    await browser.close();

    console.log('Scraping completed and data saved to output.csv');
}

main();
