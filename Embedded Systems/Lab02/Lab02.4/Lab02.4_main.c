#include <msp430fr6989.h>
#define redLED BIT0		// Red LED at P1.0
#define greenLED BIT7	// Green LED at P9.7
#define BUT1 BIT1		// Button S1 at P1.1
#define BUT2 BIT2		// Button S2 at P1.2

void main(void){
	WDTCTL = WDTPW | WDTHOLD;
	PM5CTL0 &= ~LOCKLPM5;

	// Initialize LEDs
	P1DIR |= redLED;		// Direct pin 1 as output
	P9DIR |= greenLED; 		// Direct pin 9 as output
	P1OUT &= ~redLED; 		// Turn LED off
	P9OUT &= ~greenLED; 	// Turn LED off

	// Configure buttons 
	P1DIR = ~(BUT1 | BUT2);		// Direct pin as input
	P1REN |= BUT1 | BUT2;    	// Enable the built-in resistor
	P1OUT |= BUT1 | BUT2; 		// Set resistor as pull-up

	// Polling the button in an infinite loop
	for (;;){
		if (((P1IN & BUT1) == 0) && ((P1IN & BUT2) != 0)){
			P1OUT |= redLED;
			P9OUT &= ~greenLED;
		}else if (((P1IN & BUT2) == 0) && ((P1IN & BUT1) != 0)){
			P9OUT |= greenLED;
			P1OUT &= ~redLED;
		}else if (((P1IN & BUT2) == 0) && ((P1IN & BUT1) == 0)){
			while((((P1IN & BUT2) == 0) || ((P1IN & BUT1) == 0))){
				P9OUT &= ~greenLED;
				P1OUT &= ~redLED;
			}
		}else {
			P9OUT &= ~greenLED;
			P1OUT &= ~redLED;
		}
	}
}
