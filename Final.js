const { google } = require('googleapis');
const { Firestore } = require('@google-cloud/firestore');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const he = require('he');

const CLIENT_ID = "";
const CLIENT_SECRET = "";
const Redirect_URI = "https://developers.google.com/oauthplayground";

const REFRESH_TOKEN = '';
const  ACCESS_TOKEN = '';



const openai = new OpenAIApi(new Configuration({ apiKey: '' }));

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, Redirect_URI);
oAuth2Client.setCredentials({
  access_token: ACCESS_TOKEN,
  refresh_token: REFRESH_TOKEN,
});

const firestore = new Firestore({
  keyFilename: path.resolve(__dirname, 'gmail.json'),
});



  async function categorizeEmailIntent(emailText) {
    // Define the prompt format for email categorization
    const prompt = `Determine the intent from the below email if the email is a person seeking to invest in my ArbitrageAI Company label the intent as invest, a future client trying to schedule a meeting becuase they are intrested in buying one of my companies' product or service and becomg a potentional customer label the intent as meeting(For it could be Digital mArketing company that intrested in getting ai automations built by my AI company), a cold outreach (a person offering services or products, trying to sell something to me and want mes to use or buy thier product) label the intent as cold mail, or a customer support question(a customer asking a question about my companies' product or service) label the intent as support.\n\nEmail:\n\n${emailText}\n\nCategory:`;
  
    try {
      // Make a request to OpenAI's API for email categorization
      const response = await openai.createCompletion({
        model: 'text-davinci-003', // Specify the language model
        prompt: prompt,
        max_tokens: 1, // Limit the response to one token for the category
        temperature: 0, // Use a temperature of 0 for deterministic output
        n: 1, // Generate a single completion
        stop: null, // Stop condition for completion generation (if needed)
      });
  
      // Retrieve the predicted category from the API response
      const category = response.data.choices[0].text.trim();
  
      return category;
    } catch (error) {
      console.error('Failed to generate response using OpenAI:', error);
      return 'unknown'; // Return 'unknown' category in case of an error
    }
  }
  
async function generateResponse(prompt, category, name = '') {
  let message = '';

  if (category === 'Invest') {
    message = `Dear ${name || 'Investor'},\n\n${prompt}\n\nAs an AI with the following guidelines: Summarize their offer in a maximum of two sentences. Ignore any invitation to schedule a call. Inform them that the timing is not right now and that we hope to start fundraising shortly. Ask them to confirm if they want to be added to the investor list. Make sure to included Hi {the actual name of the person who sent the email}, in the beginning of the email. How would you respond?`;
  } else if (category === 'Cold') {
    message = `The email is a cold email meaning its email of someone one trying to sell you to buy their product or a service : \n\n${prompt}\n\nAs an AI with the following guidelines: craft a response that politely expresses disinterest in their products or services. Begin the email with "Hi [the actual name of the person who sent the email]," and ensure that your response is professional and respectful. Clearly communicate that you are not interested in their offerings at the moment, while maintaining a courteous tone throughout the email. Your message should be a maximum of four sentences, so make sure to convey your points concisely. Your goal is to politely decline their offer and potentially leave the door open for future opportunities, if applicable.
    Guidelines:
    1. Begin the email with "Hi [the actual name of the person who sent the email]," to establish a polite and personalized tone.
    2. Express appreciation for their email and their effort in reaching out.
    3. Clearly state that you are not interested in their products or services at the moment.
    4. If applicable, mention any specific reasons for your disinterest, such as current commitments or a lack of immediate need.
    5. Thank them for understanding your position and politely decline any further follow-up.
    6. Optionally, consider leaving the door open for future opportunities by expressing interest in keeping their contact information for future reference, if it aligns with your organization's policies.
    Craft a polite and professional response that clearly communicates your disinterest in their products or services while maintaining a respectful tone. How would you respond?`;
  } else if (category === 'Support') {
    message = `A customer support email reads: \n\n${prompt}\n\nAs an AI with the following guidelines:  craft response that uses ai’s knowledge base to answer the question that the customer is asking. Make sure to included Hi {the actual name of the person who sent the email}, in the beginning of the email. How would you respond?`;
  } else if (category === 'Meeting') {
    message = `An email  of a potential client requesting a meeting because intrested in buying one of the products and services reads: \n\n${prompt}\n\nAs an AI with the following guidelines: craft a compelling response that effectively closes the deal and helps schedule the meeting. Your response should address the client's interest, provide additional information about our products or services, highlight their benefits, and emphasize the value we can offer. Your message should be a maximum of four sentences, so make sure to convey your points concisely while maintaining a persuasive tone. Ultimately, your goal is to convince the client of the value proposition and secure a meeting to discuss their requirements further. Guidelines: 1. Acknowledge the client's interest in our products or services.2. Express gratitude for their inquiry and demonstrate enthusiasm. 3. Provide an overview of our products or services, highlighting their key features and benefits.4. Propose a meeting to discuss the client's requirements in detail and offer assistance in finding a suitable date and time.Craft a concise and persuasive response that helps close the deal and schedule the meeting. Make sure to included Hi {the actual name of the person who sent the email}, in the beginning of the email. How would you respond?`;
  }

  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: message,
      max_tokens: 200,
      temperature: 0.6,
    });

    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Failed to generate response using OpenAI:', error);
  }
}

async function replyToEmail(gmail, email, messageText) {
    const to = email.data.payload.headers.find((header) => header.name === 'From').value;
    const subject = email.data.payload.headers.find((header) => header.name === 'Subject').value;
    const threadId = email.data.threadId;
  
    const str = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      'Content-Transfer-Encoding: 7bit\n',
      'to: ', to, '\n',
      'subject: Re: ', subject, '\n\n',
      messageText
    ].join('');
  
    const encodedMessage = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  
    try {
      const sendResponse = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId
        }
      });
  
      console.log('Message sent, id:', sendResponse.data.id);
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  }



  function convertEmailText(emailText) {
    // Check if the emailText is a string
    if (typeof emailText !== 'string') {
      return emailText;
    }
  
    // Decode HTML entities
    var decodedText = he.decode(emailText);
  
    // Add line breaks after punctuation marks
    var punctuationMarks = ['.', '!', '?'];
    punctuationMarks.forEach(function (mark) {
      decodedText = decodedText.replace(mark, mark + '\n\n');
    });
  
    return decodedText;
  }
  


  
  async function fetchAndProcessEmails() {
    try {
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const day = today.getDate();
  
      const q = `after:${year}-${month}-${day}`;
  
      const response = await gmail.users.messages.list({
        userId: 'me',
        q,
      });
  
      const emails = response.data.messages;
      for (const email of emails) {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: email.id,
          format: 'full', // Request the full email format
        });
  
        const labelIds = message.data.labelIds;
        if (labelIds && labelIds.includes('UNREAD')) {
          const subjectHeader = message.data.payload.headers.find((header) => header.name === 'Subject');
          const senderHeader = message.data.payload.headers.find((header) => header.name === 'From');
          const subject = subjectHeader && subjectHeader.value ? subjectHeader.value : '';
          const sender = senderHeader && senderHeader.value ? senderHeader.value : '';
          let body = '';
  
          // Search for the plain text body
          const plainTextPart = message.data.payload.parts && message.data.payload.parts.find((part) => part.mimeType === 'text/plain');
          if (plainTextPart && plainTextPart.body && plainTextPart.body.data) {
            body = decodeBase64Url(plainTextPart.body.data).replace(/(\r\n|\r|\n)/g, ' ');
          }
  
          if (subject && sender && body) {
            // Categorize the email intent
            const category = await categorizeEmailIntent(body);
  
            // Generate response using AI
            const responseText = await generateResponse(body, category);
  
            await replyToEmail(gmail, message, responseText);

            console.log('Email Category:', category);
            console.log('Full Email:', body); // Output the full email body
            console.log('AI Response:', responseText);
  
            // Mark the email as read
            await gmail.users.messages.modify({
              userId: 'me',
              id: email.id,
              resource: {
                removeLabelIds: ['UNREAD'],
              },
            });
  
           // console.log('Email processed:', { subject, sender, body });
          } else {
            console.log('Incomplete email data:', { subject, sender, body });
          }
        }
      }
  
      console.log('API calls successful');
      return true;
    } catch (error) {
      console.error('Error fetching and processing emails:', error);
      return false;
    }
  }
  
  function decodeBase64Url(base64UrlString) {
    const base64String = base64UrlString.replace(/-/g, '+').replace(/_/g, '/');
    const decodedString = atob(base64String);
    return decodedString;
  }
  
  
  
  function decodeBase64Url(base64UrlString) {
    const base64String = base64UrlString.replace(/-/g, '+').replace(/_/g, '/');
    const decodedString = atob(base64String);
    return decodedString;
  }
  
  
  
  
  

  
  
  
  async function startEmailProcessing() {
    while (true) {
      const isSuccessful = await fetchAndProcessEmails();
      console.log('Is successful:', isSuccessful);
  
      // Delay for a specified interval (e.g., 1 minute)
      await delay(10000);
    }
  }
  
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  startEmailProcessing().catch((error) => {
    console.error('Error in email processing:', error);
  });