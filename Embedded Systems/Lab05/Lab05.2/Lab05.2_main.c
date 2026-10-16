#include <msp430.h> 
#include <stdint.h>
#define redLED BIT0 // Red at P1.0
#define BUT1 BIT1 // Button S1 at Port 1.1
#define BUT2 BIT2 // Button S2 at Port 1.2
volatile unsigned int n, m, i, j;

const unsigned char LCD_Shapes[10] = {0xFC, 0x60, 0xDB, 0xF3, 0x67, 0xB7, 0xBF, 0xE0, 0xFF, 0xE7};
int main(void){
	WDTCTL = WDTPW | WDTHOLD; // Stop the Watchdog timer
	PM5CTL0 &= ~LOCKLPM5; 	// Enable the GPIO pins
	P1DIR |= redLED; 			// Pins as output
	P1OUT |= redLED; 			// Red on

	// Initialize button with interupts
	P1DIR &= ~(BUT1|BUT2); // 0: input
	P1REN |= (BUT1|BUT2);  // 1: enable built-in resistors
	P1OUT |= (BUT1|BUT2);  // 1: built-in resistor is pulled up to Vcc
	P1IES |= (BUT1|BUT2);  // 1: interrupt on falling edge (0 for rising edge)
	P1IFG &= ~(BUT1|BUT2); // 0: clear the interrupt flags
	P1IE  |= (BUT1|BUT2);  // 1: enable the interrupts

	// Configure ACLK to the 32 KHz crystal
	config_ACLK_to_32KHz_crystal();

	// Initializes the LCD_C module
	Initialize_LCD();

	// Enables all interups
	__enable_interrupt();

	// Timer_A: ACLK, div by 1, up mode, clear TAR
	TA0CTL = TASSEL_1 | ID_0 | MC_1 | TACLR ;
	TA0CCR0 = 32768 - 1;
	TA0CCTL0 &= ~CCIFG;

	// Flash the red LED
	for(;;) {
		for (m = 0; m <= 9; m++){
			LCDM4  = LCD_Shapes[m];
			for (j = 0; j <= 9; j++){
				LCDM19  = LCD_Shapes[j];
				for(i = 0; i <= 5; i++){
					LCDM15  = LCD_Shapes[i]; 
					for(n=0; n<=9; n++) {
						P1OUT ^= redLED;
						LCDM8  = LCD_Shapes[n];
						//Empty Loop to wait for a second 
						while((TA0CCTL0 & CCIFG) == 0) {};
						// Clear the flag for the next second.
						TA0CCTL0 &= ~CCIFG;
					} 
				}
			}
		}
		LCDCMEMCTL = LCDCLRM; // Clears all the segment
	}
	return 0;
}

#pragma vector = PORT1_VECTOR // Write the vector name
__interrupt void Port1_ISR() {
	_delay_cycles(20000);
	if ((P1IFG & BUT1) != 0){
		n = m = j = i = 0;
		LCDM8  = LCD_Shapes[n];
		LCDM4  = LCD_Shapes[m];
		LCDM19 = LCD_Shapes[j];
		LCDM15  = LCD_Shapes[i]; 
		P1IFG &= ~BUT1;
	}
	else if ((P1IFG & BUT2) != 0){
		// We do this so once we reach 10 it resets back to 0
		m = (m + 1) % 10;
		LCDM4  = LCD_Shapes[m];
		P1IFG &= ~BUT2;
	}
}
// Configures ACLK to 32 KHz crystal
void config_ACLK_to_32KHz_crystal() {
// By default, ACLK runs on LFMODCLK at 5MHz/128 = 39 KHz
// Reroute pins to LFXIN/LFXOUT functionality
	PJSEL1 &= ~BIT4;
	PJSEL0 |= BIT4;
	// Wait until the oscillator fault flags remain cleared
	CSCTL0 = CSKEY; // Unlock CS registers
	do {
		CSCTL5 &= ~LFXTOFFG; // Local fault flag
		SFRIFG1 &= ~OFIFG; // Global fault flag
	}
	while((CSCTL5 & LFXTOFFG) != 0);
		CSCTL0_H = 0; // Lock CS registers
	return;
}

// Initializes the LCD_C module
// *** Source: Function obtained from MSP430FR6989’s Sample Code ***
void Initialize_LCD() {
	PJSEL0 = BIT4 | BIT5; // For LFXT

	LCDCPCTL0 = 0xFFD0;
	LCDCPCTL1 = 0xF83F;
	LCDCPCTL2 = 0x00F8;

	// Configure LFXT 32kHz crystal
	CSCTL0_H = CSKEY >> 8; 		// Unlock CS registers
	CSCTL4 &= ~LFXTOFF; 		// Enable LFXT
	do {
		CSCTL5 &= ~LFXTOFFG; 	// Clear LFXT fault flag
		SFRIFG1 &= ~OFIFG;
	}
	while (SFRIFG1 & OFIFG); 	// Test oscillator fault flag
	CSCTL0_H = 0; 				// Lock CS registers
	
	// Initialize LCD_C
	// ACLK, Divider = 1, Pre-divider = 16; 4-pin MUX
	LCDCCTL0 = LCDDIV__1 | LCDPRE__16 | LCD4MUX | LCDLP;
	
	// VLCD generated internally,
	// V2-V4 generated internally, v5 to ground
	// Set VLCD voltage to 2.60v
	// Enable charge pump and select internal reference for it
	LCDCVCTL = VLCD_1 | VLCDREF_0 | LCDCPEN;

	LCDCCPCTL = LCDCPCLKSYNC; 	// Clock synchronization enabled
	LCDCMEMCTL = LCDCLRM; 		// Clear LCD memory
	
	//Turn LCD on (do this at the end!)
	LCDCCTL0 |= LCDON;

	return;
}
